// ASR 기억 모델 — 불변식 검증(매직넘버 아님). learning-algorithm-detail.md.
import { describe, it, expect } from 'vitest'
import {
  retrievability, intervalForTarget, targetRetention, requiredTotalSessions, remainingSessions,
  capToExam, updateDifficulty, updateStability, schedule, isGraduated, DECAY_C,
  type CardMemory, type Grade,
} from './memory'

describe('retrievability R(t)', () => {
  it('갓 복습(t=0)은 1, S≤0은 0', () => {
    expect(retrievability(5, 0)).toBe(1)
    expect(retrievability(0, 3)).toBe(0)
  })
  it('시간이 지날수록 단조 감소 + [0,1]', () => {
    const r1 = retrievability(5, 1), r2 = retrievability(5, 5), r3 = retrievability(5, 50)
    expect(r1).toBeGreaterThan(r2)
    expect(r2).toBeGreaterThan(r3)
    for (const r of [r1, r2, r3]) { expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(1) }
  })
  it('앵커: t=S일 때 R≈0.9 (c=9)', () => {
    expect(retrievability(4, 4)).toBeCloseTo(0.9, 5)
    expect(DECAY_C).toBe(9)
  })
})

describe('intervalForTarget', () => {
  it('S에 단조 증가', () => {
    expect(intervalForTarget(10, 0.9)).toBeGreaterThan(intervalForTarget(5, 0.9))
  })
  it('target 0.9일 때 간격=S, 높은 target은 더 짧음', () => {
    expect(intervalForTarget(8, 0.9)).toBeCloseTo(8, 5)
    expect(intervalForTarget(8, 0.95)).toBeLessThan(intervalForTarget(8, 0.9))
  })
  it('잘못된 target은 throw', () => {
    expect(() => intervalForTarget(5, 1)).toThrow()
    expect(() => intervalForTarget(5, 0)).toThrow()
  })
})

describe('targetRetention', () => {
  it('1주 이상 0.90, 시험일·이후 0.95, 사이 단조', () => {
    expect(targetRetention(10)).toBe(0.90)
    expect(targetRetention(7)).toBe(0.90)
    expect(targetRetention(0)).toBe(0.95)
    expect(targetRetention(-3)).toBe(0.95)
    expect(targetRetention(3)).toBeGreaterThan(0.90)
    expect(targetRetention(3)).toBeLessThan(0.95)
    expect(targetRetention(2)).toBeGreaterThan(targetRetention(5)) // 가까울수록 ↑
  })
})

describe('requiredTotalSessions / remainingSessions (공유 헬퍼)', () => {
  it('긴 시험은 N_min=3, 짧은 시험은 daysLeft로 완화, ≥1', () => {
    expect(requiredTotalSessions(10)).toBe(3)
    expect(requiredTotalSessions(2)).toBe(2)   // 2일 남으면 3세션 불가 → 2
    expect(requiredTotalSessions(0)).toBe(1)
    expect(requiredTotalSessions(Infinity)).toBe(3)
  })
  it('remaining = 필요 − 이미성공, ≥1', () => {
    expect(remainingSessions(0, 10)).toBe(3)
    expect(remainingSessions(2, 10)).toBe(1)
    expect(remainingSessions(5, 10)).toBe(1) // 음수 방지
  })
})

describe('capToExam', () => {
  it('자연간격을 넘지 않고 ≥1', () => {
    expect(capToExam(20, 10, 3)).toBeLessThanOrEqual(20)
    expect(capToExam(20, 10, 3)).toBeGreaterThanOrEqual(1)
  })
  it('시험 임박이면 자연간격보다 압축', () => {
    expect(capToExam(20, 6, 3)).toBeLessThan(20) // 6/3=2일 슬롯
  })
  it('시험 없으면(Infinity) 자연간격 그대로', () => {
    expect(capToExam(20, Infinity, 3)).toBe(20)
  })
})

describe('updateDifficulty', () => {
  it('실패는 ↑, 쉬움은 ↓, [0,1] 클램프', () => {
    expect(updateDifficulty(0.5, 'again')).toBeGreaterThan(0.5)
    expect(updateDifficulty(0.5, 'easy')).toBeLessThan(0.5)
    expect(updateDifficulty(1, 'again')).toBe(1)
    expect(updateDifficulty(0, 'easy')).toBe(0)
  })
})

describe('updateStability', () => {
  it('신규 첫 성공: again<hard<good<easy', () => {
    const s = (g: Grade) => updateStability(0, 0.3, g, 1, 0)
    expect(s('again')).toBeLessThan(s('hard'))
    expect(s('hard')).toBeLessThan(s('good'))
    expect(s('good')).toBeLessThan(s('easy'))
  })
  it('신규: 어려운 카드일수록 초기 S 낮음', () => {
    expect(updateStability(0, 0.8, 'good', 1, 0)).toBeLessThan(updateStability(0, 0.1, 'good', 1, 0))
  })
  it('복습 성공은 S 증가, 실패(again)는 감소', () => {
    expect(updateStability(5, 0.3, 'good', 0.9, 3)).toBeGreaterThan(5)
    expect(updateStability(5, 0.3, 'again', 0.9, 3)).toBeLessThan(5)
  })
  it('desirable difficulty: 낮은 R에서 맞힐수록 S 상승폭 큼', () => {
    const lowR = updateStability(5, 0.3, 'good', 0.6, 3)
    const highR = updateStability(5, 0.3, 'good', 0.95, 3)
    expect(lowR).toBeGreaterThan(highR)
  })
  it('good < easy 상승폭', () => {
    expect(updateStability(5, 0.3, 'good', 0.9, 3)).toBeLessThan(updateStability(5, 0.3, 'easy', 0.9, 3))
  })
})

describe('schedule (합성)', () => {
  const base: CardMemory = { S: 5, D: 0.3, reps: 3, successDays: 1 }
  const now = new Date('2026-06-01T00:00:00Z')

  it('사전테스트는 S/D 불변 + skipped', () => {
    const r = schedule(base, 'again', { now, elapsedDays: 5, wasPretest: true })
    expect(r.skipped).toBe(true)
    expect(r.S).toBe(base.S)
    expect(r.D).toBe(base.D)
  })
  it('성공은 successDays 증가, 실패는 유지', () => {
    expect(schedule(base, 'good', { now, elapsedDays: 5 }).successDays).toBe(2)
    expect(schedule(base, 'again', { now, elapsedDays: 5 }).successDays).toBe(1)
  })
  it('dueAt = now + intervalDays', () => {
    const r = schedule(base, 'good', { now, elapsedDays: 5 })
    expect(r.dueAt.getTime()).toBeCloseTo(now.getTime() + r.intervalDays * 86_400_000, -2)
    expect(r.intervalDays).toBeGreaterThan(0)
  })
  it('시험 임박이면 간격이 cap됨(먼 시험보다 짧음)', () => {
    const near = schedule(base, 'good', { now, elapsedDays: 5, examDate: new Date('2026-06-05T00:00:00Z') })
    const far = schedule(base, 'good', { now, elapsedDays: 5, examDate: new Date('2027-06-01T00:00:00Z') })
    expect(near.intervalDays).toBeLessThanOrEqual(far.intervalDays)
  })
})

describe('isGraduated', () => {
  const mem = (successDays: number): CardMemory => ({ S: 30, D: 0.2, reps: 5, successDays })
  it('충분한 분산일 + 마지막 good + R≥target이면 졸업', () => {
    expect(isGraduated(mem(3), 'good', 20, 0.95)).toBe(true)
  })
  it('분산일 부족이면 미졸업', () => {
    expect(isGraduated(mem(1), 'good', 20, 0.95)).toBe(false)
  })
  it('마지막이 again이면 미졸업', () => {
    expect(isGraduated(mem(3), 'again', 20, 0.95)).toBe(false)
  })
  it('짧은 시험(2일)이면 3일 조건 완화 → 2일 성공으로 졸업 가능', () => {
    expect(isGraduated(mem(2), 'good', 2, 0.99)).toBe(true)
  })
})
