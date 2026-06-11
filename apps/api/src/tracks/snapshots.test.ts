// 스냅샷 — avgRExam·localDay 불변식(시험 미설정/학습 전 null·경계·감쇠 단조).
import { describe, it, expect } from 'vitest'
import { avgRExam, localDay } from './snapshots.js'
import type { CardStateLike } from '../scheduler/plan.js'

const NOW = new Date(2026, 5, 11)          // 2026-06-11 로컬
const EXAM = new Date(2026, 6, 11)          // 30일 후
const studied = (S: number, lastReviewedAt: Date | null = NOW): CardStateLike =>
  ({ stage: 'review', S, D: 0.3, dueAt: NOW, reps: 3, lapses: 0, lastReviewedAt })
const fresh = (): CardStateLike => ({ stage: 'new', S: 0, D: 0.3, dueAt: NOW, reps: 0, lapses: 0, lastReviewedAt: null })

describe('localDay', () => {
  it('로컬 자정 기준 YYYY-MM-DD', () => {
    expect(localDay(new Date(2026, 5, 9))).toBe('2026-06-09')
    expect(localDay(new Date(2026, 11, 1))).toBe('2026-12-01')
  })
})

describe('avgRExam', () => {
  it('시험 미설정 → null', () => {
    expect(avgRExam([studied(5)], NOW, null)).toBeNull()
  })
  it('학습한 카드 없으면(전부 신규/S=0) → null', () => {
    expect(avgRExam([fresh(), fresh()], NOW, EXAM)).toBeNull()
  })
  it('결과는 0..1 범위', () => {
    const r = avgRExam([studied(2), studied(20)], NOW, EXAM)
    expect(r).not.toBeNull()
    expect(r as number).toBeGreaterThanOrEqual(0)
    expect(r as number).toBeLessThanOrEqual(1)
  })
  it('S 클수록(감쇠 적을수록) R 높음', () => {
    const lo = avgRExam([studied(2)], NOW, EXAM) as number
    const hi = avgRExam([studied(40)], NOW, EXAM) as number
    expect(hi).toBeGreaterThan(lo)
  })
  it('신규 카드는 평균에서 제외(학습 카드만 반영)', () => {
    const only = avgRExam([studied(10)], NOW, EXAM) as number
    const mixed = avgRExam([studied(10), fresh()], NOW, EXAM) as number
    expect(mixed).toBe(only) // fresh가 0으로 끌어내리지 않음
  })
})
