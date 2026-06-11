// ASR 기억 모델 — 순수 함수(DB·시간 부수효과 없음). learning-algorithm-detail.md.
// 핵심: 등급 → 안정도 S 갱신 → 간격 = R이 target까지 떨어지는 시점(별도 ease 없음) → 시험일로 cap.
// 모든 상수는 **예시값(illustrative)** — 추후 reviewLogs로 적합. 테스트는 값이 아니라 불변식을 검증.

export type Grade = 'again' | 'hard' | 'good' | 'easy'

// R(t) = 1/(1 + t/(c·S)). c는 "target=0.9에서 간격=S"가 되도록 고른 앵커.
//   I = c·S·(1/target − 1);  target 0.9 → I=S,  target 0.95 → I≈0.47·S(시험 임박 시 더 촘촘).
export const DECAY_C = 9
export const N_MIN = 3        // 졸업에 필요한 "서로 다른 날 성공" 기본값
export const MIN_S = 0.1      // 안정도 하한(일)

// ── 인출확률 R(t) ──────────────────────────────────────────────────────────
// S>0(이미 복습된 카드)만 의미 있음. 신규(S=0)는 R이 아니라 intake가 다룬다.
export function retrievability(S: number, elapsedDays: number): number {
  if (S <= 0) return 0
  if (elapsedDays <= 0) return 1
  return 1 / (1 + elapsedDays / (DECAY_C * S))
}

// ── 간격: R이 target까지 떨어지는 일수 = c·S·(1/target − 1) ──────────────────
export function intervalForTarget(S: number, target: number): number {
  if (target <= 0 || target >= 1) throw new RangeError('target must be in (0,1)')
  return DECAY_C * S * (1 / target - 1)
}

// ── 목표 보유율: 평소 0.90 → 시험 1주 전부터 0.95로 상향 ──────────────────────
export function targetRetention(daysLeft: number): number {
  if (daysLeft <= 0) return 0.95
  if (daysLeft >= 7) return 0.90
  return 0.90 + ((7 - daysLeft) / 7) * 0.05
}

// ── 공유 헬퍼: 시험까지 필요한 성공 세션 수(짧은 시험이면 N_min 완화) ──────────
// §5.5-8 + §6: feasibility·졸업·capToExam이 같은 값을 써야 "feasible" 거짓판정을 막음.
export function requiredTotalSessions(daysLeft: number, nMin = N_MIN): number {
  if (!Number.isFinite(daysLeft)) return nMin
  return Math.max(1, Math.min(nMin, Math.floor(daysLeft)))
}
export function remainingSessions(successDays: number, daysLeft: number, nMin = N_MIN): number {
  return Math.max(1, requiredTotalSessions(daysLeft, nMin) - successDays)
}

// ── 간격 cap: 시험 전 균등하게 남은 세션을 끼우도록 자연간격을 누름 ──────────────
export function capToExam(naturalInterval: number, daysLeft: number, remSessions: number): number {
  if (!Number.isFinite(daysLeft)) return naturalInterval
  const slot = Math.max(1, Math.floor(daysLeft / Math.max(1, remSessions)))
  return Math.min(naturalInterval, slot)
}

// ── 난이도 D 갱신: 틀리면 ↑, 쉬우면 ↓. [0,1] ────────────────────────────────
const D_DELTA: Record<Grade, number> = { again: 0.15, hard: 0.05, good: -0.02, easy: -0.08 }
export function updateDifficulty(D: number, grade: Grade): number {
  return Math.min(1, Math.max(0, D + D_DELTA[grade]))
}

// ── 안정도 S 갱신 ───────────────────────────────────────────────────────────
// 신규 첫 성공: 등급별 초기 S(난이도로 하향). 이후: 성장배수.
//   desirable difficulty — 낮은 R에서 맞힐수록 S 상승폭 ↑(정보이득 큼). §2·§4.
const INIT_S: Record<Grade, number> = { again: 0.3, hard: 0.5, good: 1.0, easy: 2.0 }
const GROWTH_MULT: Record<Grade, number> = { again: 0, hard: 0.4, good: 1.0, easy: 1.6 }
const GROWTH_BASE = 1.2

export function updateStability(S: number, D: number, grade: Grade, R: number, reps: number): number {
  if (reps === 0) return Math.max(MIN_S, INIT_S[grade] * (1 - 0.3 * D)) // 첫 획득
  if (grade === 'again') return Math.max(MIN_S, S * (0.5 - 0.2 * D))    // 실패 → 큰 폭 하락
  const difficultyPenalty = 1 - 0.4 * D     // 어려운 카드일수록 덜 오름
  const retrievabilityBonus = 1 + (1 - R)   // 낮은 R에서 맞힐수록 더 오름(desirable difficulty)
  const growth = 1 + GROWTH_BASE * GROWTH_MULT[grade] * difficultyPenalty * retrievabilityBonus
  return S * growth
}

// ── 합성: 한 번의 인출 → 갱신된 S/D/다음 due ─────────────────────────────────
export type CardMemory = { S: number; D: number; reps: number; successDays: number }
export type ScheduleInput = {
  now: Date
  examDate?: Date | null
  elapsedDays: number   // 마지막 복습 후 경과(신규면 무시)
  wasPretest?: boolean
}
export type ScheduleResult = {
  S: number; D: number; dueAt: Date; intervalDays: number
  R: number; target: number; successDays: number; skipped: boolean
}

export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000
}

export function schedule(mem: CardMemory, grade: Grade, input: ScheduleInput): ScheduleResult {
  // 사전테스트는 S/D를 건드리지 않는다(기록만) — 인코딩 전 S 추락 방지. §5.5·data-model.
  if (input.wasPretest) {
    return { S: mem.S, D: mem.D, dueAt: input.now, intervalDays: 0, R: 0, target: 0.9, successDays: mem.successDays, skipped: true }
  }
  const R = mem.reps === 0 ? 1 : retrievability(mem.S, input.elapsedDays)
  const newS = updateStability(mem.S, mem.D, grade, R, mem.reps)
  const newD = updateDifficulty(mem.D, grade)
  const success = grade !== 'again'
  const newSuccessDays = success ? mem.successDays + 1 : mem.successDays

  const daysLeft = input.examDate ? daysBetween(input.now, input.examDate) : Number.POSITIVE_INFINITY
  const target = targetRetention(daysLeft)
  const natural = intervalForTarget(newS, target)
  const interval = input.examDate
    ? capToExam(natural, daysLeft, remainingSessions(newSuccessDays, daysLeft))
    : natural

  const dueAt = new Date(input.now.getTime() + interval * 86_400_000)
  return { S: newS, D: newD, dueAt, intervalDays: interval, R, target, successDays: newSuccessDays, skipped: false }
}

// ── 졸업(숙달) 판정 — §6. 짧은 시험이면 "서로 다른 날" 조건 완화(공유 헬퍼 사용). ──
export function isGraduated(
  mem: CardMemory, lastGrade: Grade, daysLeft: number, predictedRAtExam: number,
): boolean {
  const enoughDays = mem.successDays >= requiredTotalSessions(daysLeft)
  const lastOk = lastGrade === 'good' || lastGrade === 'easy'
  const target = targetRetention(daysLeft)
  return enoughDays && lastOk && predictedRAtExam >= target
}
