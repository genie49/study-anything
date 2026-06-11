// 스케줄 건강 상태기계 + 실현가능성 — 순수 함수. learning-algorithm-detail.md §5.5.
// ⚠️ BEHIND는 원인이 둘이고 처방이 정반대다(과부하 vs 숙달부족) — 절대 하나로 합치지 않는다.
import { requiredTotalSessions } from './memory'

export type HealthState =
  | 'no_exam'         // 시험일 미설정 → 계획 생성 불가
  | 'on_track'        // 백로그≈0, 정상 페이스 · target 0.90
  | 'behind_overload' // 카드 과다(백로그>용량) · 신규 중단 · target 유지/하향
  | 'behind_mastery'  // 자꾸 틀림(백로그 작은데 lapse 빈발) · target 상향 · 약점 집중
  | 'ahead'           // 오늘 큐 소진 + 여력 · 신규 앞당김 · 심화
  | 'infeasible'      // 수요 > 공급 · 트리아지 필요

export type HealthInput = {
  examSet: boolean
  daysLeft: number
  backlog: number          // 연체(과거 due인데 밀린) 카드 수
  dueToday: number         // 오늘 due 복습 수
  capacityPerDay: number   // 그날 처리 가능 카드 수
  newRemaining: number     // 아직 도입 안 한 신규 카드 수
  lapseRate: number        // 최근 실패율 [0,1]
  feasible: boolean        // feasibility()의 판정
}

export type HealthAdvice = {
  state: HealthState
  suspendNew: boolean      // 신규 도입 중단?
  targetDelta: number      // 목표 보유율 가감(+상향 / 0 유지 / -하향)
}

const LAPSE_HIGH = 0.30    // 숙달부족 판정 임계(예시값)

// 매 세션 시작 시 현재 상태에서 판정(고정 플랜 없음).
export function healthState(i: HealthInput): HealthAdvice {
  if (!i.examSet) return { state: 'no_exam', suspendNew: true, targetDelta: 0 }
  if (!i.feasible) return { state: 'infeasible', suspendNew: true, targetDelta: 0 } // 트리아지로 분기

  const todayLoad = i.backlog + i.dueToday

  // 과부하: 백로그가 용량을 초과 → 신규 중단, target은 올리지 않음(올리면 복습 더 늘어 악화).
  if (i.backlog > i.capacityPerDay) {
    return { state: 'behind_overload', suspendNew: true, targetDelta: 0 }
  }
  // 숙달부족: 백로그는 작은데 자꾸 실패 → 복습이 모자란 것 → target 상향 + 약점 집중.
  if (i.lapseRate > LAPSE_HIGH) {
    return { state: 'behind_mastery', suspendNew: false, targetDelta: +0.05 }
  }
  // 앞섬: 오늘 처리할 게 없고 신규도 없음 → 여력 → 신규 앞당김/심화.
  if (todayLoad === 0 && i.newRemaining === 0) {
    return { state: 'ahead', suspendNew: false, targetDelta: 0 }
  }
  return { state: 'on_track', suspendNew: false, targetDelta: 0 }
}

// ── 실현가능성 — 수요(분) vs 공급(분). §5.5-8. ─────────────────────────────────
// 슬롯 계산은 "서로 다른 날" 분산을 못 보므로, 남은 필요세션은 공유 헬퍼로 짧은-시험 완화 적용.
export type FeasibilityInput = {
  unmasteredCount: number
  daysLeft: number
  capacityMinPerDay: number   // 하루 가용 분
  secPerRetrieval: number     // 인출 1회 평균 초(데이터 없으면 ~10)
}
export type Feasibility = { feasible: boolean; requiredMin: number; availableMin: number; requiredRetrievals: number }

export function feasibility(i: FeasibilityInput): Feasibility {
  const sessionsPerCard = requiredTotalSessions(i.daysLeft)
  const requiredRetrievals = i.unmasteredCount * sessionsPerCard
  const requiredMin = (requiredRetrievals * i.secPerRetrieval) / 60
  const availableMin = i.capacityMinPerDay * Math.max(0, i.daysLeft)
  return { feasible: requiredMin <= availableMin, requiredMin, availableMin, requiredRetrievals }
}
