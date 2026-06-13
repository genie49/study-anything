// 일일 플랜 계산 — 불변식. learning-algorithm-detail.md §5.5·§7.
import { describe, it, expect } from 'vitest'
import { computeTrackPlan, type CardStateLike } from './plan.js'

const NOW = new Date('2026-06-01T09:00:00Z')
const EXAM = new Date('2026-06-15T00:00:00Z')

const mkNew = (): CardStateLike => ({ stage: 'new', S: 0, D: 0.3, dueAt: NOW, reps: 0, lapses: 0 })
const mkReview = (dueOffsetDays: number, lapses = 0): CardStateLike => ({
  stage: 'review', S: 5, D: 0.3, reps: 3, lapses,
  dueAt: new Date(NOW.getTime() + dueOffsetDays * 86_400_000),
})
// 스케줄러가 실제로 쓰는 졸업 단계명은 'maintaining'이다(session.ts). 숙달 카운트는 이 이름을 봐야 한다.
const mkMastered = (): CardStateLike => ({ stage: 'maintaining', S: 40, D: 0.2, dueAt: NOW, reps: 6, lapses: 0 })

describe('computeTrackPlan', () => {
  it('갓 import한 트랙(전부 신규) — 신규만 오늘 도입, 복습·백로그 0', () => {
    const p = computeTrackPlan(Array.from({ length: 20 }, mkNew), { now: NOW, examDate: EXAM })
    expect(p.total).toBe(20)
    expect(p.mastered).toBe(0)
    expect(p.newRemaining).toBe(20)
    expect(p.todayReview).toBe(0)
    expect(p.backlog).toBe(0)
    expect(p.todayNew).toBeGreaterThan(0)
    expect(p.todayNew).toBeLessThanOrEqual(20)
    expect(p.progressPct).toBe(0)
    expect(p.studied).toBe(0)      // reps=0 → 아직 안 푼 카드
    expect(p.studiedPct).toBe(0)
  })

  it('한 번이라도 푼 카드(reps>0)가 studied/studiedPct에 즉시 반영', () => {
    // 신규 5 + 복습 5(reps=3, 미숙달) → studied=5, total=10 → 50%
    const states = [...Array.from({ length: 5 }, mkNew), ...Array.from({ length: 5 }, () => mkReview(1))]
    const p = computeTrackPlan(states, { now: NOW, examDate: EXAM })
    expect(p.total).toBe(10)
    expect(p.studied).toBe(5)
    expect(p.studiedPct).toBe(50)
    expect(p.mastered).toBe(0)     // 숙달과는 별개 — studied가 먼저 움직인다
  })

  it('시험 미설정 → no_exam · daysLeft null · 신규 중단', () => {
    const p = computeTrackPlan(Array.from({ length: 10 }, mkNew), { now: NOW, examDate: null })
    expect(p.examSet).toBe(false)
    expect(p.daysLeft).toBeNull()
    expect(p.health).toBe('no_exam')
    expect(p.suspendNew).toBe(true)
    expect(p.todayNew).toBe(0)
  })

  it('연체 복습이 용량 초과 → behind_overload · 신규 0', () => {
    const states = Array.from({ length: 100 }, () => mkReview(-3)) // 3일 연체
    const p = computeTrackPlan(states, { now: NOW, examDate: EXAM, capacityPerDay: 40 })
    expect(p.backlog).toBe(100)
    expect(p.health).toBe('behind_overload')
    expect(p.suspendNew).toBe(true)
    expect(p.todayNew).toBe(0)
    expect(p.todayReview).toBe(40) // 용량으로 cap
  })

  it('숙달 카드 비율이 진도% 에 반영', () => {
    const states = [...Array.from({ length: 3 }, mkMastered), ...Array.from({ length: 1 }, mkNew)]
    const p = computeTrackPlan(states, { now: NOW, examDate: EXAM })
    expect(p.mastered).toBe(3)
    expect(p.progressPct).toBe(75)
  })

  it('오늘 할 일 ≤ 용량, 예상시간 = 분 환산', () => {
    const states = Array.from({ length: 200 }, mkNew)
    const p = computeTrackPlan(states, { now: NOW, examDate: EXAM, capacityPerDay: 30, secPerRetrieval: 12 })
    expect(p.todayTotal).toBeLessThanOrEqual(30)
    expect(p.estMinutes).toBe(Math.round((p.todayTotal * 12) / 60))
  })

  it('archived는 제외', () => {
    const states: CardStateLike[] = [mkNew(), { ...mkNew(), archived: true }]
    expect(computeTrackPlan(states, { now: NOW, examDate: EXAM }).total).toBe(1)
  })
})
