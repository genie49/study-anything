// 트랙 통계 집계 — 불변식(프리테스트 제외·정답률·진행률·7일 버킷). 매직 수치 아님.
import { describe, it, expect } from 'vitest'
import { computeTrackStats, type ReviewLogLike } from './stats'
import type { CardStateLike } from '../scheduler/plan'

const NOW = new Date('2026-06-11T09:00:00')
const st = (stage: string): CardStateLike => ({ stage, S: 1, D: 0.3, dueAt: NOW, reps: 1, lapses: 0 })
const log = (grade: string, ts: Date, wasPretest = false): ReviewLogLike => ({ grade, ts, wasPretest })

describe('computeTrackStats', () => {
  it('빈 입력 — 0·null', () => {
    const s = computeTrackStats([], [], NOW)
    expect(s.total).toBe(0)
    expect(s.progressPct).toBe(0)
    expect(s.totalReviews).toBe(0)
    expect(s.accuracy).toBeNull()
    expect(s.last7).toHaveLength(7)
    expect(s.last7.every((d) => d.count === 0)).toBe(true)
  })

  it('진행률 = mastered/total, archived 제외', () => {
    const states = [st('mastered'), st('maintain'), st('review'), st('new'), { ...st('mastered'), archived: true }]
    const s = computeTrackStats(states, [], NOW)
    expect(s.total).toBe(4)        // archived 1개 제외
    expect(s.mastered).toBe(2)
    expect(s.progressPct).toBe(50)
  })

  it('프리테스트는 정답률·활동에서 제외', () => {
    const logs = [
      log('good', NOW), log('again', NOW),
      log('again', NOW, true), // 프리테스트 — 무시
    ]
    const s = computeTrackStats([], logs, NOW)
    expect(s.totalReviews).toBe(2)         // 프리테스트 제외
    expect(s.accuracy).toBe(0.5)           // good 1 / 2 (again은 실패)
    expect(s.byGrade).toEqual({ again: 1, hard: 0, good: 1, easy: 0 })
  })

  it('정답률 = grade !== again 비율', () => {
    const logs = [log('good', NOW), log('hard', NOW), log('easy', NOW), log('again', NOW)]
    const s = computeTrackStats([], logs, NOW)
    expect(s.accuracy).toBe(0.75)          // again만 실패
  })

  it('최근 7일 버킷 — 오늘 포함, 날짜별 집계', () => {
    const today = new Date('2026-06-11T20:00:00')
    const yesterday = new Date('2026-06-10T08:00:00')
    const longAgo = new Date('2026-05-01T08:00:00') // 7일 밖 → 어떤 버킷에도 안 들어감
    const logs = [log('good', today), log('good', today), log('again', yesterday), log('good', longAgo)]
    const s = computeTrackStats([], logs, NOW)
    expect(s.last7).toHaveLength(7)
    expect(s.last7[6].day).toBe('06-11')   // 마지막 = 오늘
    expect(s.last7[6].count).toBe(2)
    expect(s.last7[5].day).toBe('06-10')
    expect(s.last7[5].count).toBe(1)
    expect(s.last7.reduce((a, d) => a + d.count, 0)).toBe(3) // longAgo 제외
  })
})
