// 건강 상태기계 + 실현가능성 — 불변식. learning-algorithm-detail.md §5.5.
import { describe, it, expect } from 'vitest'
import { healthState, feasibility, type HealthInput } from './health.js'

const base: HealthInput = {
  examSet: true, daysLeft: 14, backlog: 0, dueToday: 5,
  capacityPerDay: 40, newRemaining: 10, lapseRate: 0.1, feasible: true,
}

describe('healthState', () => {
  it('시험 미설정 → no_exam', () => {
    expect(healthState({ ...base, examSet: false }).state).toBe('no_exam')
  })
  it('실현 불가 → infeasible', () => {
    expect(healthState({ ...base, feasible: false }).state).toBe('infeasible')
  })
  it('백로그 > 용량 → behind_overload (신규 중단, target 안 올림)', () => {
    const a = healthState({ ...base, backlog: 100, capacityPerDay: 40 })
    expect(a.state).toBe('behind_overload')
    expect(a.suspendNew).toBe(true)
    expect(a.targetDelta).toBe(0)
  })
  it('백로그 작은데 lapse 빈발 → behind_mastery (target 상향)', () => {
    const a = healthState({ ...base, backlog: 5, capacityPerDay: 40, lapseRate: 0.5 })
    expect(a.state).toBe('behind_mastery')
    expect(a.targetDelta).toBeGreaterThan(0)
    expect(a.suspendNew).toBe(false)
  })
  it('과부하와 숙달부족은 정반대 처방(합쳐지지 않음)', () => {
    const overload = healthState({ ...base, backlog: 100, lapseRate: 0.5 }) // 백로그 우선
    const mastery = healthState({ ...base, backlog: 2, lapseRate: 0.5 })
    expect(overload.state).toBe('behind_overload')
    expect(mastery.state).toBe('behind_mastery')
    expect(overload.targetDelta).toBe(0)
    expect(mastery.targetDelta).toBeGreaterThan(0)
  })
  it('오늘 큐 소진 + 신규 없음 → ahead', () => {
    expect(healthState({ ...base, backlog: 0, dueToday: 0, newRemaining: 0 }).state).toBe('ahead')
  })
  it('그 외 정상 → on_track (target 0 가감)', () => {
    const a = healthState(base)
    expect(a.state).toBe('on_track')
    expect(a.targetDelta).toBe(0)
    expect(a.suspendNew).toBe(false)
  })
})

describe('feasibility', () => {
  it('공급 ≥ 수요면 feasible', () => {
    const f = feasibility({ unmasteredCount: 30, daysLeft: 14, capacityMinPerDay: 60, secPerRetrieval: 10 })
    expect(f.feasible).toBe(true)
    expect(f.requiredMin).toBeLessThanOrEqual(f.availableMin)
  })
  it('수요 > 공급이면 infeasible', () => {
    const f = feasibility({ unmasteredCount: 500, daysLeft: 2, capacityMinPerDay: 20, secPerRetrieval: 10 })
    expect(f.feasible).toBe(false)
  })
  it('짧은 시험은 완화된 세션 수 사용(필요 인출 = 카드 × min(N_min,daysLeft))', () => {
    const f = feasibility({ unmasteredCount: 10, daysLeft: 2, capacityMinPerDay: 999, secPerRetrieval: 10 })
    expect(f.requiredRetrievals).toBe(20) // 10 × 2(완화), 3 아님
  })
})
