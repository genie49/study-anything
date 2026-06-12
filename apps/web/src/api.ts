// 백엔드 트랙 API 클라이언트. accessToken(메모리) 동봉 + 401 시 침묵 refresh 후 1회 재시도.
// auth.md: access는 Authorization: Bearer, refresh는 httpOnly 쿠키(credentials:'include').
import { getAccessToken, tryRefresh } from './auth'

const API = import.meta.env.VITE_API_URL ?? ''

export type Track = { id: string; trackSlug: string; title: string; examDate: string | null; status: string }
export type ImportSummary = { trackId: string; trackSlug: string; title: string; decks: number; concepts: number; cards: number; archived: number }
export type HealthState = 'no_exam' | 'on_track' | 'behind_overload' | 'behind_mastery' | 'ahead' | 'infeasible'
export type TrackPlan = {
  examSet: boolean; daysLeft: number | null; health: HealthState; suspendNew: boolean
  total: number; mastered: number; progressPct: number
  studied: number; studiedPct: number
  todayNew: number; todayReview: number; todayTotal: number; estMinutes: number
  backlog: number; newRemaining: number; feasible: boolean
}
export type Snapshot = { day: string; health: HealthState; avgRExam: number | null; mastered: number; total: number; backlog: number }
export type GradeDist = { again: number; hard: number; good: number; easy: number }
export type DayCount = { day: string; count: number }
export type TrackStats = {
  total: number; mastered: number; progressPct: number
  totalReviews: number; accuracy: number | null
  byGrade: GradeDist; last7: DayCount[]
}
export type SessionItem = {
  stateId: string; cardId: string; conceptId: string; mode: 'new' | 'review'; type: string
  prompt: string; answer: string; explanation: string; hint: string | null; distractors: string[]
  conceptTitle: string; conceptBodyMd: string; conceptPassed: boolean
}
export type SessionQueue = { trackId: string; total: number; items: SessionItem[] }
export type AnswerResult = {
  cardId: string; score: number; grade: 'again' | 'hard' | 'good' | 'easy'; correct: boolean
  graderMode: 'llm' | 'fallback'
  reason: string; answer: string; explanation: string; dueAt: string; stage: string
}

async function authedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API}${path}`, { ...init, headers, credentials: 'include' })
  if (res.status === 401 && retry && (await tryRefresh())) {
    return authedFetch(path, init, false) // refresh 성공 → 새 access로 1회 재시도
  }
  return res
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const j = await res.json() as { error?: string }
    return j.error ?? `${res.status}`
  } catch { return `${res.status}` }
}

// GET /tracks — 내 트랙 목록(저장 필드만, 파생값 없음).
export async function getTracks(): Promise<Track[]> {
  const res = await authedFetch('/tracks')
  if (!res.ok) throw new Error(`트랙 목록 조회 실패 (${await errorMessage(res)})`)
  return (await res.json() as { tracks: Track[] }).tracks
}

// GET /tracks/:id/plan — 무동결 일일 플랜(런타임 재계산).
export async function getPlan(id: string): Promise<TrackPlan> {
  const res = await authedFetch(`/tracks/${id}/plan`)
  if (!res.ok) throw new Error(`플랜 조회 실패 (${await errorMessage(res)})`)
  return (await res.json() as { plan: TrackPlan }).plan
}

// GET /tracks/:id/snapshots — 일별 스냅샷 시계열(보유율 곡선·건강 추이). 앱 연 날만 존재.
export async function getSnapshots(id: string): Promise<Snapshot[]> {
  const res = await authedFetch(`/tracks/${id}/snapshots`)
  if (!res.ok) throw new Error(`스냅샷 조회 실패 (${await errorMessage(res)})`)
  return (await res.json() as { snapshots: Snapshot[] }).snapshots
}

// GET /tracks/:id/stats — cardStates/reviewLogs 집계(정직한 실수치).
export async function getStats(id: string): Promise<TrackStats> {
  const res = await authedFetch(`/tracks/${id}/stats`)
  if (!res.ok) throw new Error(`통계 조회 실패 (${await errorMessage(res)})`)
  return (await res.json() as { stats: TrackStats }).stats
}

// GET /tracks/:id/session — 오늘 학습할 실제 카드/개념 큐.
// extra=true → 추가 학습(할당량 소진/실현 어려움이어도 다음 가치 있는 카드를 받아온다).
export async function getSession(id: string, opts: { extra?: boolean } = {}): Promise<SessionQueue> {
  const res = await authedFetch(`/tracks/${id}/session${opts.extra ? '?extra=1' : ''}`)
  if (!res.ok) throw new Error(`세션 생성 실패 (${await errorMessage(res)})`)
  return (await res.json() as { session: SessionQueue }).session
}

// POST /tracks/:id/concept/:conceptId/explain — 자기설명("왜?") LLM 피드백.
// 미통과 개념의 다지기 게이트: LLM 통과 판정 시 서버가 통과를 영속화(다음부터 conceptPassed=true).
export type ExplainFeedback = { sufficient: boolean; feedback: string; mode?: string }
export async function gradeExplanation(trackId: string, conceptId: string, explanation: string): Promise<ExplainFeedback> {
  const res = await authedFetch(`/tracks/${trackId}/concept/${conceptId}/explain`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ explanation }),
  })
  if (!res.ok) throw new Error(`자기설명 피드백 실패 (${await errorMessage(res)})`)
  return (await res.json() as { feedback: ExplainFeedback }).feedback
}

// POST /tracks/:id/session/suspend — "다시 안 보기": 오류 문제를 세션·스케줄에서 영구 제외.
export async function suspendCard(trackId: string, stateId: string): Promise<void> {
  const res = await authedFetch(`/tracks/${trackId}/session/suspend`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stateId }),
  })
  if (!res.ok) throw new Error(`다시 안 보기 실패 (${await errorMessage(res)})`)
}

// POST /tracks/:id/session/answer — 답안 제출 + 상태 갱신.
export async function submitAnswer(trackId: string, input: { stateId: string; cardId: string; answer: string; elapsedMs?: number }): Promise<AnswerResult> {
  const res = await authedFetch(`/tracks/${trackId}/session/answer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`답안 제출 실패 (${await errorMessage(res)})`)
  return (await res.json() as { result: AnswerResult }).result
}

// POST /tracks/import — .soul.zip 멀티파트 업로드(브라우저가 boundary 설정 → content-type 수동 지정 금지).
export async function importZip(file: File): Promise<ImportSummary> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await authedFetch('/tracks/import', { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`업로드 실패 (${await errorMessage(res)})`)
  return await res.json() as ImportSummary
}

// PATCH /tracks/:id — 이름·시험일 수정.
export async function patchTrack(id: string, patch: { title?: string; examDate?: string | null }): Promise<Track> {
  const res = await authedFetch(`/tracks/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`트랙 수정 실패 (${await errorMessage(res)})`)
  return (await res.json() as { track: Track }).track
}

// DELETE /tracks/:id — cascade 영구 삭제.
export async function deleteTrack(id: string): Promise<void> {
  const res = await authedFetch(`/tracks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`트랙 삭제 실패 (${await errorMessage(res)})`)
}
