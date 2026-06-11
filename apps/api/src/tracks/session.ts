// 학습 세션 큐 로더 — 현재 cardStates에서 오늘 시작할 실제 카드 목록을 만든다.
// 상태 갱신/채점은 다음 증분에서 처리하고, 여기서는 "무엇을 보여줄지"만 반환한다.
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo'
import { computeTrackPlan } from '../scheduler/plan'
import { daysBetween, isGraduated, retrievability, schedule, type Grade } from '../scheduler/memory'

export type SessionItem = {
  stateId: string
  cardId: string
  mode: 'new' | 'review'
  type: string
  prompt: string
  answer: string
  explanation: string
  hint: string | null
  distractors: string[]
  conceptTitle: string
  conceptBodyMd: string
}

export type SessionQueue = {
  trackId: string
  total: number
  items: SessionItem[]
}

type StateDoc = {
  _id: ObjectId; cardId: ObjectId; trackId: ObjectId; userId: string
  stage?: string; S?: number; D?: number; dueAt?: Date; reps?: number; lapses?: number
  lastReviewedAt?: Date | null; archived?: boolean; successDays?: string[]
}

function isNewState(s: StateDoc): boolean {
  return s.stage === 'new' || (s.reps ?? 0) === 0
}

function toPlanState(s: StateDoc) {
  return {
    stage: s.stage ?? 'new',
    S: s.S ?? 0,
    D: s.D ?? 0.3,
    dueAt: s.dueAt instanceof Date ? s.dueAt : new Date(s.dueAt ?? Date.now()),
    reps: s.reps ?? 0,
    lapses: s.lapses ?? 0,
    lastReviewedAt: s.lastReviewedAt ?? null,
    archived: s.archived ?? false,
  }
}

export async function getSessionQueue(userId: string, trackId: string, now = new Date()): Promise<SessionQueue | null> {
  if (!ObjectId.isValid(trackId)) return null
  const db = getDb()
  const _id = new ObjectId(trackId)
  const track = await db.collection('tracks').findOne({ _id, userId, status: { $ne: 'deleted' } })
  if (!track) return null

  const states = await db.collection<StateDoc>('cardStates')
    .find({ userId, trackId: _id, archived: { $ne: true }, triaged: { $ne: true } })
    .sort({ dueAt: 1 })
    .toArray()
  const plan = computeTrackPlan(states.map(toPlanState), {
    now,
    examDate: (track.examDate as Date | null) ?? null,
    capacityPerDay: (track.dailyCapacity as number | undefined) ?? undefined,
  })

  const dueReview = states.filter((s) => !isNewState(s) && (s.dueAt?.getTime() ?? 0) <= now.getTime()).slice(0, plan.todayReview)
  const fresh = states.filter(isNewState).slice(0, plan.todayNew)
  const picked = [...dueReview, ...fresh]
  if (!picked.length) return { trackId, total: 0, items: [] }

  const cardIds = picked.map((s) => s.cardId)
  const cards = await db.collection('cards').find({ _id: { $in: cardIds }, userId, trackId: _id, status: 'active' }).toArray()
  const cardById = new Map(cards.map((c) => [String(c._id), c]))
  const conceptIds = [...new Set(cards.map((c) => String(c.conceptId)).filter(Boolean))].map((id) => new ObjectId(id))
  const concepts = await db.collection('concepts').find({ _id: { $in: conceptIds }, userId, trackId: _id }).toArray()
  const conceptById = new Map(concepts.map((c) => [String(c._id), c]))

  const items = picked.flatMap((s): SessionItem[] => {
    const card = cardById.get(String(s.cardId))
    if (!card) return []
    const concept = conceptById.get(String(card.conceptId))
    return [{
      stateId: String(s._id),
      cardId: String(card._id),
      mode: isNewState(s) ? 'new' : 'review',
      type: (card.type as string) ?? 'qa',
      prompt: (card.prompt as string) ?? '',
      answer: (card.answer as string) ?? '',
      explanation: (card.explanation as string) ?? '',
      hint: (card.hint as string | null) ?? null,
      distractors: (card.distractors as string[] | undefined) ?? [],
      conceptTitle: (concept?.title as string | undefined) ?? '개념',
      conceptBodyMd: (concept?.bodyMd as string | undefined) ?? '',
    }]
  })

  return { trackId, total: items.length, items }
}

export type AnswerInput = {
  stateId: string
  cardId: string
  answer: string
  elapsedMs?: number
}

export type AnswerResult = {
  cardId: string
  score: number
  grade: Grade
  correct: boolean
  reason: string
  answer: string
  explanation: string
  dueAt: string
  stage: string
}

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function gradeAnswer(card: { type?: string; answer?: string; explanation?: string }, learnerAnswer: string): Pick<AnswerResult, 'score' | 'grade' | 'correct' | 'reason'> {
  const expected = normalizeAnswer(card.answer ?? '')
  const actual = normalizeAnswer(learnerAnswer)
  const correct = !!expected && actual === expected
  return {
    score: correct ? 1 : 0,
    grade: correct ? 'good' : 'again',
    correct,
    reason: correct
      ? '정답이에요. 참조 정답과 일치합니다.'
      : '아직 달라요. 정답과 해설을 보고 다시 떠올려 보세요.',
  }
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function submitSessionAnswer(userId: string, trackId: string, input: AnswerInput, now = new Date()): Promise<AnswerResult | null> {
  if (!ObjectId.isValid(trackId) || !ObjectId.isValid(input.stateId) || !ObjectId.isValid(input.cardId)) return null
  const db = getDb()
  const _id = new ObjectId(trackId)
  const stateId = new ObjectId(input.stateId)
  const cardId = new ObjectId(input.cardId)

  const [track, state, card] = await Promise.all([
    db.collection('tracks').findOne({ _id, userId, status: { $ne: 'deleted' } }),
    db.collection<StateDoc>('cardStates').findOne({ _id: stateId, userId, trackId: _id, cardId, archived: { $ne: true } }),
    db.collection('cards').findOne({ _id: cardId, userId, trackId: _id, status: 'active' }),
  ])
  if (!track || !state || !card) return null

  const graded = gradeAnswer(card as { type?: string; answer?: string; explanation?: string }, input.answer)
  const prevS = state.S ?? 0
  const prevD = state.D ?? 0.3
  const prevReps = state.reps ?? 0
  const elapsedDays = state.lastReviewedAt instanceof Date ? Math.max(0, daysBetween(state.lastReviewedAt, now)) : 0
  const previousSuccessDays = state.successDays ?? []
  const today = dayKey(now)
  const nextSuccessDays = graded.grade === 'again' || previousSuccessDays.includes(today)
    ? previousSuccessDays
    : [...previousSuccessDays, today]

  const scheduled = schedule(
    { S: prevS, D: prevD, reps: prevReps, successDays: previousSuccessDays.length },
    graded.grade,
    { now, examDate: (track.examDate as Date | null) ?? null, elapsedDays },
  )
  const examDate = (track.examDate as Date | null) ?? null
  const daysLeft = examDate ? daysBetween(now, examDate) : Number.POSITIVE_INFINITY
  const rAtExam = examDate ? retrievability(scheduled.S, Math.max(0, daysBetween(now, examDate))) : 0
  const stage = graded.grade === 'again'
    ? 'acquiring'
    : isGraduated({ S: scheduled.S, D: scheduled.D, reps: prevReps + 1, successDays: nextSuccessDays.length }, graded.grade, daysLeft, rAtExam)
      ? 'maintaining'
      : 'consolidating'

  await db.collection('reviewLogs').insertOne({
    userId, trackId: _id, cardId, ts: now,
    grade: graded.grade,
    score: graded.score,
    learnerAnswer: input.answer,
    elapsedMs: input.elapsedMs ?? null,
    wasPretest: false,
    graderMode: card.type === 'mcq' ? 'mcq' : 'exact',
    rAtReview: scheduled.R,
    sBefore: prevS,
    sAfter: scheduled.S,
    dBefore: prevD,
    dAfter: scheduled.D,
  })

  await db.collection('cardStates').updateOne(
    { _id: stateId, userId, trackId: _id, cardId },
    {
      $set: {
        stage,
        S: scheduled.S,
        D: scheduled.D,
        dueAt: scheduled.dueAt,
        lastReviewedAt: now,
        lastGrade: graded.grade,
        successDays: nextSuccessDays,
        updatedAt: now,
      },
      $inc: { reps: 1, lapses: graded.grade === 'again' ? 1 : 0 },
    },
  )

  return {
    cardId: String(cardId),
    score: graded.score,
    grade: graded.grade,
    correct: graded.correct,
    reason: graded.reason,
    answer: (card.answer as string) ?? '',
    explanation: (card.explanation as string) ?? '',
    dueAt: scheduled.dueAt.toISOString(),
    stage,
  }
}
