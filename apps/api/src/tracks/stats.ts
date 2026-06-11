// 트랙 통계 — cardStates + reviewLogs 집계. 정직한 실수치만(시계열 차트는 미저장→미산출).
// 순수 함수(computeTrackStats)는 DB 비의존 → 단위테스트 가능. learning-algorithm-detail.md §6.
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo'
import type { CardStateLike } from '../scheduler/plan'

// 집계에 쓰는 reviewLog 최소 표면.
export type ReviewLogLike = { ts: Date; grade: string; wasPretest?: boolean }

export type GradeDist = { again: number; hard: number; good: number; easy: number }
export type DayCount = { day: string; count: number }

export type TrackStats = {
  total: number
  mastered: number
  progressPct: number          // mastered/total
  totalReviews: number         // 프리테스트 제외 복습 수
  accuracy: number | null      // grade !== 'again' 비율(회상 성공률). 복습 0이면 null
  byGrade: GradeDist           // 등급 분포(프리테스트 제외)
  last7: DayCount[]            // 오늘 포함 최근 7일(로컬 자정 기준), 과거→현재
}

const MASTERED_STAGES = new Set(['mastered', 'maintain'])

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function localDayLabel(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeTrackStats(states: CardStateLike[], logs: ReviewLogLike[], now: Date): TrackStats {
  const active = states.filter((s) => !s.archived)
  const total = active.length
  const mastered = active.filter((s) => MASTERED_STAGES.has(s.stage)).length

  // 프리테스트는 S를 갱신하지 않고 채점도 평가가 아니므로 정답률·활동에서 제외.
  const reviews = logs.filter((l) => !l.wasPretest)
  const totalReviews = reviews.length
  const byGrade: GradeDist = { again: 0, hard: 0, good: 0, easy: 0 }
  for (const l of reviews) if (l.grade in byGrade) byGrade[l.grade as keyof GradeDist]++
  const correct = totalReviews - byGrade.again // 회상 성공 = again 아님
  const accuracy = totalReviews > 0 ? correct / totalReviews : null

  // 최근 7일 버킷 — 로컬 자정 기준(D-day 라운딩과 동일). UTC-로컬 경계 오프바이원은 v1 허용.
  const todayStart = startOfLocalDay(now)
  const last7: DayCount[] = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * 86_400_000)
    const dayEnd = dayStart.getTime() + 86_400_000
    const count = reviews.filter((l) => l.ts.getTime() >= dayStart.getTime() && l.ts.getTime() < dayEnd).length
    last7.push({ day: localDayLabel(dayStart), count })
  }

  return {
    total,
    mastered,
    progressPct: total > 0 ? Math.round((mastered / total) * 100) : 0,
    totalReviews,
    accuracy,
    byGrade,
    last7,
  }
}

type StateDoc = { stage?: string; S?: number; D?: number; dueAt?: Date; reps?: number; lapses?: number; lastReviewedAt?: Date | null; archived?: boolean }
type LogDoc = { ts?: Date; grade?: string; wasPretest?: boolean }

function toStateLike(s: StateDoc): CardStateLike {
  return {
    stage: s.stage ?? 'new', S: s.S ?? 0, D: s.D ?? 0.3,
    dueAt: s.dueAt instanceof Date ? s.dueAt : new Date(s.dueAt ?? Date.now()),
    reps: s.reps ?? 0, lapses: s.lapses ?? 0,
    lastReviewedAt: s.lastReviewedAt ?? null, archived: s.archived ?? false,
  }
}

export async function getTrackStats(userId: string, trackId: string, now = new Date()): Promise<TrackStats | null> {
  if (!ObjectId.isValid(trackId)) return null
  const db = getDb()
  const _id = new ObjectId(trackId)
  const track = await db.collection('tracks').findOne({ _id, userId, status: { $ne: 'deleted' } })
  if (!track) return null

  const [states, logs] = await Promise.all([
    db.collection<StateDoc>('cardStates').find({ userId, trackId: _id, archived: { $ne: true } }).toArray(),
    db.collection<LogDoc>('reviewLogs').find({ userId, trackId: _id }).toArray(),
  ])
  const logLikes: ReviewLogLike[] = logs.map((l) => ({
    ts: l.ts instanceof Date ? l.ts : new Date(l.ts ?? Date.now()),
    grade: l.grade ?? 'again',
    wasPretest: l.wasPretest ?? false,
  }))
  return computeTrackStats(states.map(toStateLike), logLikes, now)
}
