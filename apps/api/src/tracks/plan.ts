// GET /tracks/:id/plan 로더 — 트랙 + cardStates를 읽어 무동결 플랜을 런타임 계산.
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { computeTrackPlan, type TrackPlan, type CardStateLike } from '../scheduler/plan.js'
import { avgRExam, recordSnapshot } from './snapshots.js'

export async function getTrackPlan(userId: string, trackId: string, now = new Date()): Promise<TrackPlan | null> {
  if (!ObjectId.isValid(trackId)) return null
  const db = getDb()
  const _id = new ObjectId(trackId)
  const track = await db.collection('tracks').findOne({ _id, userId })
  if (!track) return null

  const rows = await db.collection('cardStates').find({ userId, trackId: _id, archived: { $ne: true } }).toArray()
  const states: CardStateLike[] = rows.map((s) => ({
    stage: (s.stage as string) ?? 'new',
    S: (s.S as number) ?? 0,
    D: (s.D as number) ?? 0.3,
    dueAt: s.dueAt instanceof Date ? s.dueAt : new Date(s.dueAt as string),
    reps: (s.reps as number) ?? 0,
    lapses: (s.lapses as number) ?? 0,
    lastReviewedAt: (s.lastReviewedAt as Date | null) ?? null,
    archived: false,
  }))

  const examDate = (track.examDate as Date | null) ?? null
  const plan = computeTrackPlan(states, {
    now,
    examDate,
    capacityPerDay: (track.dailyCapacity as number | undefined) ?? undefined,
  })

  // 일별 스냅샷 lazy upsert(차트용 시계열). 스냅샷 실패가 플랜 응답을 막지 않게 격리.
  try {
    await recordSnapshot(userId, _id, {
      health: plan.health, avgRExam: avgRExam(states, now, examDate),
      mastered: plan.mastered, total: plan.total, backlog: plan.backlog,
    }, now)
  } catch { /* 스냅샷 기록 실패는 무시 */ }

  return plan
}
