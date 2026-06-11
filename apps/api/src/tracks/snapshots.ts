// 트랙 일별 스냅샷 — 통계 차트(보유율 곡선·건강 추이)용 시계열.
// 풀 상태(health·avg R(시험일)·숙달)는 로그로 복원 불가 → 플랜 읽기 시 그날치를 upsert.
// 앱을 연 날만 기록되므로 idle 날은 공백(보간 금지). avgRExam만 새 순수 로직 → 단위테스트.
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { retrievability, daysBetween } from '../scheduler/memory.js'
import type { CardStateLike } from '../scheduler/plan.js'
import type { HealthState } from '../scheduler/health.js'

export type SnapshotData = {
  health: HealthState
  avgRExam: number | null   // 학습한 카드의 예측 R(시험일) 평균. 시험 미설정/학습 전이면 null
  mastered: number
  total: number
  backlog: number
}
export type SnapshotRow = SnapshotData & { day: string } // day = 'YYYY-MM-DD'(로컬)

// 로컬 자정 기준 날짜키(D-day·통계 7일 버킷과 정합).
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 학습한(reps>0, S>0) 카드의 R(시험일) 평균. 신규(S=0)는 R≈0으로 곡선을 0에 고정하므로 제외.
// 예측 R는 마지막 복습 시점→시험일 경과로 감쇠(추가 복습 없다고 가정).
export function avgRExam(states: CardStateLike[], now: Date, examDate: Date | null): number | null {
  if (!examDate) return null
  const studied = states.filter((s) => !s.archived && s.reps > 0 && s.S > 0)
  if (!studied.length) return null
  const sum = studied.reduce((acc, s) => {
    const from = s.lastReviewedAt instanceof Date ? s.lastReviewedAt : now
    const t = Math.max(0, daysBetween(from, examDate))
    return acc + retrievability(s.S, t)
  }, 0)
  return sum / studied.length
}

// 그날치 스냅샷 upsert(같은 날 여러 번 읽으면 마지막 값으로 갱신). 실패는 호출부에서 무시.
export async function recordSnapshot(userId: string, trackId: ObjectId, data: SnapshotData, now: Date): Promise<void> {
  const day = localDay(now)
  await getDb().collection('trackSnapshots').updateOne(
    { userId, trackId, day },
    { $set: { ...data, ts: now }, $setOnInsert: { userId, trackId, day } },
    { upsert: true },
  )
}

type SnapDoc = { day?: string; health?: HealthState; avgRExam?: number | null; mastered?: number; total?: number; backlog?: number }

export async function getTrackSnapshots(userId: string, trackId: string, days = 14): Promise<SnapshotRow[] | null> {
  if (!ObjectId.isValid(trackId)) return null
  const db = getDb()
  const _id = new ObjectId(trackId)
  const track = await db.collection('tracks').findOne({ _id, userId, status: { $ne: 'deleted' } })
  if (!track) return null

  // day는 'YYYY-MM-DD' 문자열이라 사전식 정렬 = 시간순. 최근 days개만.
  const rows = await db.collection<SnapDoc>('trackSnapshots').find({ userId, trackId: _id }).sort({ day: 1 }).toArray()
  return rows.slice(-days).map((r) => ({
    day: r.day ?? '',
    health: (r.health ?? 'no_exam') as HealthState,
    avgRExam: r.avgRExam ?? null,
    mastered: r.mastered ?? 0,
    total: r.total ?? 0,
    backlog: r.backlog ?? 0,
  }))
}
