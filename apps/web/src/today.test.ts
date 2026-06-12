// 오늘 탭 집계 — 불변식(순열·완료 후순위·합산·위험순). 매직 순서 아님.
import { describe, it, expect } from 'vitest'
import { summarizeToday, type TodayRow } from './today'
import type { Track, TrackPlan, HealthState } from './api'

const track = (id: string): Track => ({ id, trackSlug: id, title: id, examDate: '2026-07-15', status: 'active' })
const plan = (p: Partial<TrackPlan> & { health: HealthState; todayTotal: number }): TrackPlan => ({
  examSet: true, daysLeft: 30, suspendNew: false, total: 10, mastered: 0, progressPct: 0,
  studied: 0, studiedPct: 0,
  todayNew: 0, todayReview: 0, estMinutes: 0, backlog: 0, newRemaining: 0, feasible: true,
  ...p,
})
const row = (id: string, p: Partial<TrackPlan> & { health: HealthState; todayTotal: number }): TodayRow =>
  ({ track: track(id), plan: plan(p) })

describe('summarizeToday', () => {
  it('빈 입력 → 0 합산', () => {
    expect(summarizeToday([])).toEqual({ rows: [], totalCards: 0, totalMinutes: 0, remaining: 0 })
  })

  it('항상 순열(같은 트랙 집합 유지)', () => {
    const rows = [row('a', { health: 'on_track', todayTotal: 5 }), row('b', { health: 'ahead', todayTotal: 0 })]
    const ids = summarizeToday(rows).rows.map((r) => r.track.id).sort()
    expect(ids).toEqual(['a', 'b'])
  })

  it('할 일 있는 트랙이 완료 트랙보다 위', () => {
    const rows = [row('done', { health: 'ahead', todayTotal: 0 }), row('todo', { health: 'on_track', todayTotal: 3 })]
    expect(summarizeToday(rows).rows.map((r) => r.track.id)).toEqual(['todo', 'done'])
  })

  it('건강 위험도가 높은 트랙이 먼저', () => {
    const rows = [
      row('calm', { health: 'on_track', todayTotal: 5 }),
      row('crit', { health: 'behind_overload', todayTotal: 5 }),
    ]
    expect(summarizeToday(rows).rows[0].track.id).toBe('crit')
  })

  it('합산 = todayTotal·estMinutes 합, remaining = 할 일 남은 트랙 수', () => {
    const rows = [
      row('a', { health: 'on_track', todayTotal: 4, estMinutes: 8 }),
      row('b', { health: 'on_track', todayTotal: 0, estMinutes: 0 }),
      row('c', { health: 'behind_overload', todayTotal: 10, estMinutes: 20 }),
    ]
    const s = summarizeToday(rows)
    expect(s.totalCards).toBe(14)
    expect(s.totalMinutes).toBe(28)
    expect(s.remaining).toBe(2)
  })
})
