// 학습 세션 큐 로더 — 현재 cardStates에서 오늘 시작할 실제 카드 목록을 만든다.
// 상태 갱신/채점은 다음 증분에서 처리하고, 여기서는 "무엇을 보여줄지"만 반환한다.
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo'
import { computeTrackPlan } from '../scheduler/plan'

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
  lastReviewedAt?: Date | null; archived?: boolean
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
