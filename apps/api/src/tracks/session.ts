// 학습 세션 큐 로더 — 현재 cardStates에서 오늘 시작할 실제 카드 목록을 만든다.
// 상태 갱신/채점은 다음 증분에서 처리하고, 여기서는 "무엇을 보여줄지"만 반환한다.
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { gradeCardAnswer, type GraderMode } from '../grading/grader.js'
import { computeTrackPlan } from '../scheduler/plan.js'
import { interleaveSession } from '../scheduler/session-order.js'
import { daysBetween, isGraduated, retrievability, schedule, type Grade } from '../scheduler/memory.js'

export type SessionItem = {
  stateId: string
  cardId: string
  conceptId: string
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

// extra=true → "추가 학습": 일일 캡·suspendNew를 무시하고 가용 카드를 우선순위로 채운다.
// 학습은 언제나 가능해야 한다 — 오늘 할당량 소진/실현 어려움(신규 중단)으로 todayTotal=0이어도
// 사용자가 더 하고 싶으면 다음으로 가치 있는 카드를 내준다. 미도래 복습을 당겨 풀어도 채점기가
// elapsedDays를 작게 반영해 자연스럽게 흡수하므로 별도 '연습 전용' 모드는 두지 않는다.
export async function getSessionQueue(
  userId: string,
  trackId: string,
  opts: { now?: Date; extra?: boolean } = {},
): Promise<SessionQueue | null> {
  if (!ObjectId.isValid(trackId)) return null
  const now = opts.now ?? new Date()
  const db = getDb()
  const _id = new ObjectId(trackId)
  const track = await db.collection('tracks').findOne({ _id, userId, status: { $ne: 'deleted' } })
  if (!track) return null

  const states = await db.collection<StateDoc>('cardStates')
    .find({ userId, trackId: _id, archived: { $ne: true }, triaged: { $ne: true } })
    .sort({ dueAt: 1 })
    .toArray()
  const capacityPerDay = (track.dailyCapacity as number | undefined) ?? 40
  const plan = computeTrackPlan(states.map(toPlanState), {
    now,
    examDate: (track.examDate as Date | null) ?? null,
    capacityPerDay,
  })

  let picked: StateDoc[]
  if (opts.extra) {
    // dueAt 오름차순(연체→곧 도래→미도래) 복습 먼저, 그다음 신규. 한 세션 = capacityPerDay 배치.
    const reviewAll = states.filter((s) => !isNewState(s))
    const newAll = states.filter(isNewState)
    picked = [...reviewAll, ...newAll].slice(0, capacityPerDay)
  } else {
    const dueReview = states.filter((s) => !isNewState(s) && (s.dueAt?.getTime() ?? 0) <= now.getTime()).slice(0, plan.todayReview)
    const fresh = states.filter(isNewState).slice(0, plan.todayNew)
    picked = [...dueReview, ...fresh]
  }
  if (!picked.length) return { trackId, total: 0, items: [] }

  const cardIds = picked.map((s) => s.cardId)
  const cards = await db.collection('cards').find({ _id: { $in: cardIds }, userId, trackId: _id, status: 'active' }).toArray()
  const cardById = new Map(cards.map((c) => [String(c._id), c]))
  const conceptIds = [...new Set(cards.map((c) => String(c.conceptId)).filter(Boolean))].map((id) => new ObjectId(id))
  const concepts = await db.collection('concepts').find({ _id: { $in: conceptIds }, userId, trackId: _id }).toArray()
  const conceptById = new Map(concepts.map((c) => [String(c._id), c]))

  // picked는 우선순위순(연체 복습 dueAt↑ → 신규). 개념/유형을 함께 들고 인터리빙(§7.4).
  const enriched = picked.flatMap((s) => {
    const card = cardById.get(String(s.cardId))
    if (!card) return []
    const concept = conceptById.get(String(card.conceptId))
    const item: SessionItem = {
      stateId: String(s._id),
      cardId: String(card._id),
      conceptId: String(card.conceptId ?? ''),
      mode: isNewState(s) ? 'new' : 'review',
      type: (card.type as string) ?? 'qa',
      prompt: (card.prompt as string) ?? '',
      answer: (card.answer as string) ?? '',
      explanation: (card.explanation as string) ?? '',
      hint: (card.hint as string | null) ?? null,
      distractors: (card.distractors as string[] | undefined) ?? [],
      conceptTitle: (concept?.title as string | undefined) ?? '개념',
      conceptBodyMd: (concept?.bodyMd as string | undefined) ?? '',
    }
    return [{ conceptId: String(card.conceptId ?? ''), type: item.type, item }]
  })
  const items = interleaveSession(enriched).map((e) => e.item)

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
  graderMode: GraderMode
  reason: string
  answer: string
  explanation: string
  dueAt: string
  stage: string
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

  const graded = await gradeCardAnswer(card as { type?: string; prompt?: string; answer?: string; explanation?: string; grading?: Record<string, unknown> | null }, input.answer)
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
    graderMode: graded.mode,
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
    graderMode: graded.mode,
    reason: graded.reason,
    answer: (card.answer as string) ?? '',
    explanation: (card.explanation as string) ?? '',
    dueAt: scheduled.dueAt.toISOString(),
    stage,
  }
}
