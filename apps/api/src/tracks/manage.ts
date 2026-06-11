// 트랙 수정(이름·시험일) + 삭제(cascade). userId는 호출자(JWT)가 주입.
// 화면 #3(트랙 수정)·#14(시험일 설정)·위험구역 삭제. auth.md / frontend-screens.md.
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'

// 트랙의 자식 컬렉션 — 삭제 시 cascade 대상(전부 {userId, trackId} 스코프).
const CHILD_COLLECTIONS = ['decks', 'concepts', 'cards', 'cardStates', 'reviewLogs', 'sessions', 'trackSnapshots'] as const

export type TrackPatch = { title?: string; examDate?: string | null }
export type TrackView = { id: string; trackSlug: string; title: string; examDate: string | null; status: string }
export type DeleteSummary = { trackId: string; deleted: Record<string, number> }

// 입력 검증 — 화면이 보내는 부분 수정(이름/시험일). 빈 패치·잘못된 날짜 거부.
export function validateTrackPatch(p: unknown): string[] {
  const e: string[] = []
  if (!p || typeof p !== 'object') return ['body must be an object']
  const patch = p as TrackPatch
  if (patch.title === undefined && patch.examDate === undefined)
    e.push('nothing to update — provide title and/or examDate')
  if (patch.title !== undefined && (typeof patch.title !== 'string' || !patch.title.trim()))
    e.push('title must be a non-empty string')
  if (patch.examDate !== undefined && patch.examDate !== null) {
    if (typeof patch.examDate !== 'string' || Number.isNaN(Date.parse(patch.examDate)))
      e.push('examDate must be an ISO date string or null')
  }
  return e
}

function toView(doc: Record<string, unknown>): TrackView {
  const exam = doc.examDate as Date | null | undefined
  return {
    id: String(doc._id),
    trackSlug: (doc.trackSlug as string) ?? '',
    title: (doc.title as string) ?? '',
    examDate: exam instanceof Date ? exam.toISOString() : null,
    status: (doc.status as string) ?? 'active',
  }
}

// 트랙 목록(홈 #1) — 저장된 필드만(name·slug·examDate·status). 파생값(건강·진도·
// 오늘 분량)은 스케줄러 영역이라 여기서 계산하지 않는다(그게 dumb-read 경계).
export async function listTracks(userId: string): Promise<TrackView[]> {
  const db = getDb()
  const docs = await db.collection('tracks')
    .find({ userId, status: { $ne: 'deleted' } })
    .sort({ createdAt: 1 })
    .toArray()
  return docs.map(toView)
}

// 부분 수정. 소유자(userId) 스코프 밖이거나 잘못된 id면 null(→ 404).
export async function updateTrack(userId: string, trackId: string, patch: TrackPatch): Promise<TrackView | null> {
  if (!ObjectId.isValid(trackId)) return null
  const db = getDb()
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.title !== undefined) set.title = patch.title.trim()
  if (patch.examDate !== undefined) set.examDate = patch.examDate === null ? null : new Date(patch.examDate)

  const updated = await db.collection('tracks').findOneAndUpdate(
    { _id: new ObjectId(trackId), userId },
    { $set: set },
    { returnDocument: 'after' },
  )
  return updated ? toView(updated) : null
}

// 영구 삭제(cascade). 먼저 소유권 확인 → 자식 전부 hard-delete → 트랙 삭제.
// import-time orphan soft-delete와 달리 유저가 명시적으로 지운 것이라 흔적을 남기지 않는다.
export async function deleteTrack(userId: string, trackId: string): Promise<DeleteSummary | null> {
  if (!ObjectId.isValid(trackId)) return null
  const db = getDb()
  const _id = new ObjectId(trackId)
  const track = await db.collection('tracks').findOne({ _id, userId })
  if (!track) return null

  const deleted: Record<string, number> = {}
  for (const col of CHILD_COLLECTIONS) {
    const r = await db.collection(col).deleteMany({ userId, trackId: _id })
    deleted[col] = r.deletedCount
  }
  const t = await db.collection('tracks').deleteOne({ _id, userId })
  deleted.tracks = t.deletedCount
  return { trackId, deleted }
}
