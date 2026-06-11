// 오늘 탭 집계 — 여러 트랙의 플랜을 합산·정렬하는 순수 함수(테스트 가능).
// 급한 트랙을 위로, 오늘 할 일이 없는(완료) 트랙은 아래로.
import type { Track, TrackPlan, HealthState } from './api'

export type TodayRow = { track: Track; plan: TrackPlan }

export type TodaySummary = {
  rows: TodayRow[]        // 정렬된 행
  totalCards: number      // 오늘 전체 문항(모든 트랙 todayTotal 합)
  totalMinutes: number    // 예상 분(estMinutes 합)
  remaining: number       // 아직 할 일이 남은 트랙 수
}

// 건강 위험도 순위(작을수록 위) — 실현불가 > 과부하 > 숙달부족 > 순항 > 여유 > 미설정.
const HEALTH_RANK: Record<HealthState, number> = {
  infeasible: 0, behind_overload: 1, behind_mastery: 2, on_track: 3, ahead: 4, no_exam: 5,
}

export function summarizeToday(rows: TodayRow[]): TodaySummary {
  const ordered = [...rows].sort((a, b) => {
    // 1) 할 일 있는 트랙 먼저(완료=todayTotal 0은 아래로).
    const aDone = a.plan.todayTotal === 0
    const bDone = b.plan.todayTotal === 0
    if (aDone !== bDone) return aDone ? 1 : -1
    // 2) 건강 위험순. 3) 동률이면 시험 임박(D-day 작은)순.
    const hr = HEALTH_RANK[a.plan.health] - HEALTH_RANK[b.plan.health]
    if (hr !== 0) return hr
    return (a.plan.daysLeft ?? Number.POSITIVE_INFINITY) - (b.plan.daysLeft ?? Number.POSITIVE_INFINITY)
  })
  return {
    rows: ordered,
    totalCards: rows.reduce((s, r) => s + r.plan.todayTotal, 0),
    totalMinutes: rows.reduce((s, r) => s + r.plan.estMinutes, 0),
    remaining: rows.filter((r) => r.plan.todayTotal > 0).length,
  }
}
