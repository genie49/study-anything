// api 클라이언트 단위 테스트 — fetch 모킹. 헤더 첨부 · 멀티파트 · 401 재시도 · 에러.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getAccessToken = vi.fn<() => string | null>(() => 'tok-1')
const tryRefresh = vi.fn<() => Promise<boolean>>(async () => false)
vi.mock('./auth', () => ({ getAccessToken: () => getAccessToken(), tryRefresh: () => tryRefresh() }))

import { getTracks, getSession, importZip, patchTrack, deleteTrack, submitAnswer } from './api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  fetchMock.mockReset()
  getAccessToken.mockReturnValue('tok-1')
  tryRefresh.mockResolvedValue(false)
  vi.stubGlobal('fetch', fetchMock)
})

describe('getTracks', () => {
  it('Authorization 헤더 첨부 + tracks 반환', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, tracks: [{ id: 't1', title: '토익' }] }))
    const tracks = await getTracks()
    expect(tracks).toHaveLength(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok-1')
    expect(init?.credentials).toBe('include')
  })

  it('에러 응답이면 throw', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
    await expect(getTracks()).rejects.toThrow(/boom/)
  })
})

describe('401 재시도', () => {
  it('401 → tryRefresh 성공 → 1회 재시도 후 성공', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true, tracks: [] }))
    tryRefresh.mockResolvedValueOnce(true)
    const tracks = await getTracks()
    expect(tracks).toEqual([])
    expect(tryRefresh).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('401 → refresh 실패면 재시도 없이 throw', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401))
    tryRefresh.mockResolvedValue(false)
    await expect(getTracks()).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1) // 재시도 안 함
  })
})

describe('importZip', () => {
  it('멀티파트 FormData(file) POST + summary 반환', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ trackId: 'x', title: '토익', decks: 1, cards: 2, concepts: 1, archived: 0 }))
    const file = new File([new Uint8Array([1, 2])], 'a.zip', { type: 'application/zip' })
    const s = await importZip(file)
    expect(s.trackId).toBe('x')
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toContain('/tracks/import')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('file')).toBeInstanceOf(File)
  })
})

describe('getSession', () => {
  it('세션 큐 반환', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, session: { trackId: 't1', total: 1, items: [{ cardId: 'c1', prompt: 'q' }] } }))
    const s = await getSession('t1')
    expect(s.total).toBe(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/tracks/t1/session')
  })
})

describe('submitAnswer', () => {
  it('답안 제출 POST + result 반환', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, result: { cardId: 'c1', score: 1, grade: 'good', correct: true, reason: 'ok', answer: 'a', explanation: 'e', dueAt: '2026-06-12T00:00:00.000Z', stage: 'consolidating' } }))
    const r = await submitAnswer('t1', { stateId: 's1', cardId: 'c1', answer: 'a' })
    expect(r.grade).toBe('good')
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toContain('/tracks/t1/session/answer')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ stateId: 's1', cardId: 'c1', answer: 'a' })
  })
})

describe('patchTrack / deleteTrack', () => {
  it('PATCH는 JSON 바디 + track 반환', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, track: { id: 't1', examDate: '2026-07-15T00:00:00.000Z' } }))
    const t = await patchTrack('t1', { examDate: '2026-07-15' })
    expect(t.examDate).toContain('2026-07-15')
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toContain('/tracks/t1')
    expect(init?.method).toBe('PATCH')
  })

  it('DELETE 성공', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, deleted: { tracks: 1 } }))
    await expect(deleteTrack('t1')).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE')
  })
})
