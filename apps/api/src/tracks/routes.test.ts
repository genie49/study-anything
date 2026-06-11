// 트랙 라우트 HTTP-레벨 테스트 — 인증 게이트 + userId 흐름 검증(파괴적 DELETE 보험).
// Redis denylist만 모킹(미연결 환경), 나머지는 실제 app + 인메모리 Mongo.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'

// requireAuth가 호출하는 denylist 조회만 무력화(Redis 불필요).
vi.mock('../auth/store', async (orig) => ({
  ...(await orig<typeof import('../auth/store')>()),
  isDenied: async () => false,
}))

import { zipSync, strToU8 } from 'fflate'
import app from '../app'
import { connectMongo, closeMongo, getDb } from '../db/mongo'
import { signAccess } from '../auth/jwt'
import { importBundle, type SoulBundle } from './import'

let mongod: MongoMemoryServer
const USER = 'user-route-1'
const OTHER = 'user-route-2'

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGO_URL = mongod.getUri('study')
  await connectMongo()
}, 60_000)
afterAll(async () => { await closeMongo(); await mongod?.stop() })

function bundle(): SoulBundle {
  return {
    manifest: { soulVersion: 1, trackSlug: '토익', title: '토익', decks: [{ slug: 'd1', title: 'Deck 1', order: 1 }] },
    decks: [{ deckSlug: 'd1', concepts: [{ conceptKey: 'pp', title: 'T', bodyMd: '#', order: 1,
      cards: [{ cardKey: 'c1', type: 'qa', prompt: 'q', answer: 'a', explanation: 'e', difficultyPrior: 0.3 }] }] }],
  }
}
async function bearer(userId: string): Promise<string> {
  const { token } = await signAccess(userId)
  return `Bearer ${token}`
}

describe('GET /tracks', () => {
  it('인증 없으면 401', async () => {
    expect((await app.request('/tracks')).status).toBe(401)
  })

  it('내 트랙 목록 반환', async () => {
    await importBundle(USER, bundle())
    const res = await app.request('/tracks', { headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(200)
    const json = await res.json() as { ok: boolean; tracks: { trackSlug: string }[] }
    expect(json.tracks.some((t) => t.trackSlug === '토익')).toBe(true)
  })
})

describe('GET /tracks/:id/plan', () => {
  it('인증 없으면 401', async () => {
    expect((await app.request('/tracks/abc/plan')).status).toBe(401)
  })
  it('없는 트랙 → 404', async () => {
    const res = await app.request('/tracks/64b2f0000000000000000000/plan', { headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(404)
  })
  it('import한 트랙 → 플랜 반환(전부 신규)', async () => {
    const { trackId } = await importBundle(USER, bundle())
    const res = await app.request(`/tracks/${trackId}/plan`, { headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(200)
    const { plan } = await res.json() as { plan: { total: number; newRemaining: number; examSet: boolean } }
    expect(plan.total).toBe(1)
    expect(plan.newRemaining).toBe(1)
    expect(plan.examSet).toBe(false) // bundle엔 examDate 없음
  })
})

describe('GET /tracks/:id/session', () => {
  it('인증 없으면 401', async () => {
    expect((await app.request('/tracks/abc/session')).status).toBe(401)
  })
  it('없는/타인 트랙이면 404', async () => {
    const res = await app.request('/tracks/64b64c1f01bcbad5f9f99999/session', { headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(404)
  })
  it('오늘 큐에 실제 카드와 개념 본문을 반환', async () => {
    const b = bundle()
    b.examDate = '2026-07-15'
    const { trackId } = await importBundle(USER, b)
    const res = await app.request(`/tracks/${trackId}/session`, { headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(200)
    const { session } = await res.json() as { session: { total: number; items: { mode: string; prompt: string; conceptTitle: string; conceptBodyMd: string }[] } }
    expect(session.total).toBe(1)
    expect(session.items[0].mode).toBe('new')
    expect(session.items[0].prompt).toBe('q')
    expect(session.items[0].conceptTitle).toBe('T')
    expect(session.items[0].conceptBodyMd).toBe('#')
  })
})

describe('PATCH /tracks/:id', () => {
  it('인증 없으면 401', async () => {
    const res = await app.request('/tracks/abc', { method: 'PATCH', body: '{}', headers: { 'content-type': 'application/json' } })
    expect(res.status).toBe(401)
  })

  it('시험일 설정 — 200 + examDate 영속화', async () => {
    const { trackId } = await importBundle(USER, bundle())
    const res = await app.request(`/tracks/${trackId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', authorization: await bearer(USER) },
      body: JSON.stringify({ examDate: '2026-07-15' }),
    })
    expect(res.status).toBe(200)
    const json = await res.json() as { ok: boolean; track: { examDate: string } }
    expect(json.track.examDate).toBe(new Date('2026-07-15').toISOString())
  })

  it('빈 패치 → 400', async () => {
    const { trackId } = await importBundle(USER, bundle())
    const res = await app.request(`/tracks/${trackId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', authorization: await bearer(USER) }, body: '{}',
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /tracks/import (zip 멀티파트)', () => {
  // pack_soul.py 레이아웃의 zip을 메모리에서 생성.
  function soulZip(trackSlug: string): Uint8Array {
    const manifest = { soulVersion: 1, trackSlug, title: trackSlug, decks: [{ slug: 'd1', title: 'Deck 1', order: 1 }] }
    const deck = { deckSlug: 'd1', concepts: [{ conceptKey: `${trackSlug}-pp`, title: 'T', bodyMd: '#', order: 1,
      cards: [{ cardKey: `${trackSlug}-c1`, type: 'qa', prompt: 'q', answer: 'a', explanation: 'e', difficultyPrior: 0.3 }] }] }
    return zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'decks/d1.json': strToU8(JSON.stringify(deck)) })
  }

  it('인증 없으면 401', async () => {
    const fd = new FormData()
    fd.append('file', new File([soulZip('오픽')], '오픽.zip', { type: 'application/zip' }))
    const res = await app.request('/tracks/import', { method: 'POST', body: fd })
    expect(res.status).toBe(401)
  })

  it('zip 업로드 → 200 + DB 적재', async () => {
    const fd = new FormData()
    fd.append('file', new File([soulZip('지각')], '지각.zip', { type: 'application/zip' }))
    const res = await app.request('/tracks/import', { method: 'POST', body: fd, headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(200)
    const json = await res.json() as { ok: boolean; cards: number; trackId: string }
    expect(json.cards).toBe(1)
    expect(await getDb().collection('cards').countDocuments({ userId: USER, status: 'active', soulKey: '지각-c1' })).toBe(1)
  })

  it('깨진 zip → 400', async () => {
    const fd = new FormData()
    fd.append('file', new File([new Uint8Array([1, 2, 3])], 'bad.zip', { type: 'application/zip' }))
    const res = await app.request('/tracks/import', { method: 'POST', body: fd, headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /tracks/:id', () => {
  it('인증 없으면 401', async () => {
    const res = await app.request('/tracks/abc', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  it('남의 트랙 삭제는 404 + 데이터 보존', async () => {
    const { trackId } = await importBundle(USER, bundle())
    const res = await app.request(`/tracks/${trackId}`, { method: 'DELETE', headers: { authorization: await bearer(OTHER) } })
    expect(res.status).toBe(404)
    expect(await getDb().collection('tracks').countDocuments({ _id: new ObjectId(trackId) })).toBe(1)
  })

  it('내 트랙 삭제 — 200 + cascade', async () => {
    const { trackId } = await importBundle(USER, bundle())
    const res = await app.request(`/tracks/${trackId}`, { method: 'DELETE', headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(200)
    const json = await res.json() as { ok: boolean; deleted: Record<string, number> }
    expect(json.deleted.tracks).toBe(1)
    expect(await getDb().collection('cards').countDocuments({ trackId: new ObjectId(trackId) })).toBe(0)
  })
})
