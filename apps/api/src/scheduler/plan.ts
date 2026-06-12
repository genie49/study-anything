// 일일 플랜 — cardStates에서 오늘 학습을 런타임 재계산(무동결). 순수 함수.
// learning-algorithm-detail.md §5.5·§7. DB 비의존(상태 배열을 받음) → 단위테스트 가능.
import { retrievability, targetRetention, daysBetween, requiredTotalSessions } from './memory.js'
import { healthState, feasibility, type HealthState } from './health.js'

// cardStates 한 행의 스케줄 관련 필드(DB 형태와 무관한 최소 표면).
export type CardStateLike = {
  stage: string            // 'new' | 'learning' | 'review' | 'mastered' | 'maintain' | ...
  S: number
  D: number
  dueAt: Date
  reps: number
  lapses: number
  lastReviewedAt?: Date | null
  archived?: boolean
}

export type PlanOptions = {
  now: Date
  examDate?: Date | null
  capacityPerDay?: number   // 그날 처리 가능 카드 수(기본 40)
  secPerRetrieval?: number  // 인출 1회 평균 초(기본 10)
}

export type TrackPlan = {
  examSet: boolean
  daysLeft: number | null   // 시험 미설정이면 null
  health: HealthState
  suspendNew: boolean
  total: number
  mastered: number
  progressPct: number       // mastered/total — 숙달 기준(장기 보유 신호)
  studied: number           // 한 번이라도 푼 카드(reps>0)
  studiedPct: number        // studied/total — 한 문항마다 즉시 움직이는 진척률
  // 오늘 할 일
  todayNew: number          // 개념(신규 도입)
  todayReview: number       // 다지기(복습)
  todayTotal: number
  estMinutes: number
  backlog: number           // 연체
  newRemaining: number
  feasible: boolean
}

const MASTERED_STAGES = new Set(['mastered', 'maintain'])

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function computeTrackPlan(states: CardStateLike[], opts: PlanOptions): TrackPlan {
  const now = opts.now
  const capacityPerDay = opts.capacityPerDay ?? 40
  const secPerRetrieval = opts.secPerRetrieval ?? 10
  const todayStart = startOfDay(now)

  const active = states.filter((s) => !s.archived)
  const total = active.length
  const isNew = (s: CardStateLike) => s.stage === 'new' || s.reps === 0
  const isMastered = (s: CardStateLike) => MASTERED_STAGES.has(s.stage)

  const newCards = active.filter((s) => isNew(s) && !isMastered(s))
  const reviewCards = active.filter((s) => !isNew(s) && !isMastered(s))
  const mastered = active.filter(isMastered).length
  const studied = active.filter((s) => s.reps > 0).length

  const dueReview = reviewCards.filter((s) => s.dueAt.getTime() <= now.getTime())
  const backlog = reviewCards.filter((s) => s.dueAt.getTime() < todayStart.getTime()).length
  const dueToday = dueReview.length - backlog
  const newRemaining = newCards.length
  const unmastered = total - mastered

  const examSet = !!opts.examDate
  const daysLeftRaw = examSet ? Math.ceil(daysBetween(now, opts.examDate as Date)) : Number.POSITIVE_INFINITY

  // 최근 실패율 근사 — 로그가 없으므로 누적 lapses/reps로 대용.
  const totalReps = active.reduce((a, s) => a + s.reps, 0)
  const totalLapses = active.reduce((a, s) => a + s.lapses, 0)
  const lapseRate = totalReps > 0 ? totalLapses / totalReps : 0

  const feas = feasibility({
    unmasteredCount: unmastered,
    daysLeft: daysLeftRaw,
    capacityMinPerDay: (capacityPerDay * secPerRetrieval) / 60,
    secPerRetrieval,
  })

  const advice = healthState({
    examSet, daysLeft: daysLeftRaw, backlog, dueToday,
    capacityPerDay, newRemaining, lapseRate, feasible: feas.feasible,
  })

  // 신규 도입 균등 분산(막판 몰림 방지) — §5.5-4·§5. 중단 상태면 0.
  let newPerDay: number
  if (advice.suspendNew) newPerDay = 0
  else if (examSet && Number.isFinite(daysLeftRaw)) {
    newPerDay = Math.ceil((newRemaining / Math.max(1, daysLeftRaw)) * 1.2)
  } else {
    newPerDay = Math.min(newRemaining, 10) // 시험 미설정: 보수적 기본
  }

  // 복습 먼저 용량을 채우고, 남은 용량만큼 신규.
  const todayReview = Math.min(dueReview.length, capacityPerDay)
  const todayNew = Math.min(newRemaining, newPerDay, Math.max(0, capacityPerDay - todayReview))
  const todayTotal = todayReview + todayNew
  const estMinutes = Math.round((todayTotal * secPerRetrieval) / 60)

  return {
    examSet,
    daysLeft: examSet ? daysLeftRaw : null,
    health: advice.state,
    suspendNew: advice.suspendNew,
    total,
    mastered,
    progressPct: total > 0 ? Math.round((mastered / total) * 100) : 0,
    studied,
    studiedPct: total > 0 ? Math.round((studied / total) * 100) : 0,
    todayNew, todayReview, todayTotal, estMinutes,
    backlog, newRemaining,
    feasible: feas.feasible,
  }
}

// 시험 미설정 트랙은 R/target이 무의미하므로 호출부가 daysLeft=null을 그대로 표시.
export { retrievability, targetRetention, requiredTotalSessions }
