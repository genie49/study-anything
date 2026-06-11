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

describe('GET /tracks/:id/snapshots (플랜 조회 시 일별 기록)', () => {
  it('인증 없으면 401', async () => {
    expect((await app.request('/tracks/abc/snapshots')).status).toBe(401)
  })
  it('없는 트랙 → 404', async () => {
    const res = await app.request('/tracks/64b2f0000000000000000000/snapshots', { headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(404)
  })
  it('플랜 조회가 오늘 스냅샷을 upsert(같은 날 중복=1건)', async () => {
    const b = bundle()
    b.manifest.trackSlug = '스냅'
    b.manifest.title = '스냅'
    b.examDate = '2026-07-15'
    const { trackId } = await importBundle(USER, b)
    const auth = { authorization: await bearer(USER) }

    const s0 = await app.request(`/tracks/${trackId}/snapshots`, { headers: auth })
    expect((await s0.json() as { snapshots: unknown[] }).snapshots).toHaveLength(0)

    await app.request(`/tracks/${trackId}/plan`, { headers: auth })
    await app.request(`/tracks/${trackId}/plan`, { headers: auth }) // 같은 날 → 1건 유지

    const s1 = await app.request(`/tracks/${trackId}/snapshots`, { headers: auth })
    const { snapshots } = await s1.json() as { snapshots: { day: string; health: string; total: number }[] }
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].total).toBe(1)
    expect(typeof snapshots[0].health).toBe('string')
    expect(snapshots[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('GET /tracks/:id/stats', () => {
  it('인증 없으면 401', async () => {
    expect((await app.request('/tracks/abc/stats')).status).toBe(401)
  })
  it('없는 트랙 → 404', async () => {
    const res = await app.request('/tracks/64b2f0000000000000000000/stats', { headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(404)
  })
  it('답안 제출 이력이 통계에 반영(정답률·복습수)', async () => {
    const b = bundle()
    b.manifest.trackSlug = '통계'
    b.manifest.title = '통계'
    b.examDate = '2026-07-15'
    const { trackId } = await importBundle(USER, b)
    const auth = { authorization: await bearer(USER) }

    // 갓 import → 복습 0, 정답률 null.
    const s0 = await app.request(`/tracks/${trackId}/stats`, { headers: auth })
    expect(s0.status).toBe(200)
    const { stats: before } = await s0.json() as { stats: { total: number; totalReviews: number; accuracy: number | null; last7: unknown[] } }
    expect(before.total).toBe(1)
    expect(before.totalReviews).toBe(0)
    expect(before.accuracy).toBeNull()
    expect(before.last7).toHaveLength(7)

    // 정답 제출 → 복습 1, 정답률 1.
    const sessionRes = await app.request(`/tracks/${trackId}/session`, { headers: auth })
    const { session } = await sessionRes.json() as { session: { items: { stateId: string; cardId: string }[] } }
    const item = session.items[0]
    await app.request(`/tracks/${trackId}/session/answer`, {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ stateId: item.stateId, cardId: item.cardId, answer: 'a' }),
    })

    const s1 = await app.request(`/tracks/${trackId}/stats`, { headers: auth })
    const { stats: after } = await s1.json() as { stats: { totalReviews: number; accuracy: number | null; byGrade: { good: number } } }
    expect(after.totalReviews).toBe(1)
    expect(after.accuracy).toBe(1)
    expect(after.byGrade.good).toBe(1)
  })
})

describe('GET /tracks/:id/session — 인터리빙(§7.4)', () => {
  // 2개념 × 2카드. 신규 throttle을 피하려 import 후 전 카드를 "연체 복습"으로 시딩.
  function twoConceptBundle(slug: string): SoulBundle {
    return {
      manifest: { soulVersion: 1, trackSlug: slug, title: slug, decks: [{ slug: 'd1', title: 'D', order: 1 }] },
      decks: [{ deckSlug: 'd1', concepts: [
        { conceptKey: `${slug}-A`, title: '개념A', bodyMd: '#', order: 1, cards: [
          { cardKey: `${slug}-a1`, type: 'qa', prompt: 'qa1', answer: 'a', explanation: 'e', difficultyPrior: 0.3 },
          { cardKey: `${slug}-a2`, type: 'qa', prompt: 'qa2', answer: 'a', explanation: 'e', difficultyPrior: 0.3 },
        ] },
        { conceptKey: `${slug}-B`, title: '개념B', bodyMd: '#', order: 2, cards: [
          { cardKey: `${slug}-b1`, type: 'qa', prompt: 'qb1', answer: 'a', explanation: 'e', difficultyPrior: 0.3 },
          { cardKey: `${slug}-b2`, type: 'qa', prompt: 'qb2', answer: 'a', explanation: 'e', difficultyPrior: 0.3 },
        ] },
      ] }],
      examDate: '2026-07-15',
    }
  }

  it('같은 개념 카드가 연속으로 나오지 않게 섞여 반환', async () => {
    const { trackId } = await importBundle(USER, twoConceptBundle('인터리브'))
    // dueAt 동일·연체로 만들면 시딩 순서는 [A,A,B,B] → 인터리빙 없으면 A가 연속.
    await getDb().collection('cardStates').updateMany(
      { userId: USER, trackId: new ObjectId(trackId) },
      { $set: { stage: 'review', S: 5, D: 0.3, reps: 3, lapses: 0, lastReviewedAt: new Date('2026-06-01'), dueAt: new Date('2026-06-05') } },
    )
    const res = await app.request(`/tracks/${trackId}/session`, { headers: { authorization: await bearer(USER) } })
    expect(res.status).toBe(200)
    const { session } = await res.json() as { session: { total: number; items: { conceptTitle: string }[] } }
    expect(session.total).toBe(4)
    for (let i = 1; i < session.items.length; i++) {
      expect(session.items[i].conceptTitle).not.toBe(session.items[i - 1].conceptTitle)
    }
  })
})

describe('POST /tracks/:id/session/answer', () => {
  it('인증 없으면 401', async () => {
    expect((await app.request('/tracks/abc/session/answer', { method: 'POST' })).status).toBe(401)
  })

  it('정답 제출 → reviewLog 기록 + cardState 갱신', async () => {
    const b = bundle()
    b.manifest.trackSlug = '정답제출'
    b.manifest.title = '정답제출'
    b.examDate = '2026-07-15'
    const { trackId } = await importBundle(USER, b)
    const sessionRes = await app.request(`/tracks/${trackId}/session`, { headers: { authorization: await bearer(USER) } })
    const { session } = await sessionRes.json() as { session: { items: { stateId: string; cardId: string }[] } }
    const item = session.items[0]

    const res = await app.request(`/tracks/${trackId}/session/answer`, {
      method: 'POST',
      headers: { authorization: await bearer(USER), 'content-type': 'application/json' },
      body: JSON.stringify({ stateId: item.stateId, cardId: item.cardId, answer: 'a', elapsedMs: 1200 }),
    })
    expect(res.status).toBe(200)
    const { result } = await res.json() as { result: { grade: string; score: number; stage: string; answer: string; graderMode: string } }
    expect(result.grade).toBe('good')
    expect(result.score).toBe(1)
    expect(result.graderMode).toBe('exact')
    expect(result.stage).toBe('consolidating')
    expect(result.answer).toBe('a')

    const trackObjectId = new ObjectId(trackId)
    const state = await getDb().collection('cardStates').findOne({ userId: USER, trackId: trackObjectId })
    expect(state?.reps).toBe(1)
    expect(state?.S).toBeGreaterThan(0)
    expect(state?.lastGrade).toBe('good')
    const log = await getDb().collection('reviewLogs').findOne({ userId: USER, trackId: trackObjectId })
    expect(log?.graderMode).toBe('exact')
  })

  it('오답 제출 → lapse 증가 + again', async () => {
    const b = bundle()
    b.manifest.trackSlug = '오답제출'
    b.manifest.title = '오답제출'
    b.examDate = '2026-07-15'
    const { trackId } = await importBundle(USER, b)
    const sessionRes = await app.request(`/tracks/${trackId}/session`, { headers: { authorization: await bearer(USER) } })
    const { session } = await sessionRes.json() as { session: { items: { stateId: string; cardId: string }[] } }
    const item = session.items[0]

    const res = await app.request(`/tracks/${trackId}/session/answer`, {
      method: 'POST',
      headers: { authorization: await bearer(USER), 'content-type': 'application/json' },
      body: JSON.stringify({ stateId: item.stateId, cardId: item.cardId, answer: 'wrong' }),
    })
    expect(res.status).toBe(200)
    const { result } = await res.json() as { result: { grade: string; score: number } }
    expect(result.grade).toBe('again')
    expect(result.score).toBe(0)

    const state = await getDb().collection('cardStates').findOne({ userId: USER, trackId: new ObjectId(trackId) })
    expect(state?.lapses).toBe(1)
    expect(state?.lastGrade).toBe('again')
  })
})

describe('학습 루프: 답안 제출 → 다음 큐·플랜 갱신', () => {
  // 단일 카드로 결정론적 검증: 정답 시 dueAt이 미래로 밀려(consolidating) 다음 큐에서 빠진다.
  // now 주입 없이도 실시간 < 미래 dueAt 이므로 안정적.
  it('정답 제출 후 카드가 다음 세션에서 빠지고 newRemaining이 감소', async () => {
    const b = bundle()
    b.manifest.trackSlug = '학습루프'
    b.manifest.title = '학습루프'
    b.examDate = '2026-07-15'
    const { trackId } = await importBundle(USER, b)
    const auth = { authorization: await bearer(USER) }

    // 초기: 세션 신규 1문항, 플랜 newRemaining 1
    const s1 = await app.request(`/tracks/${trackId}/session`, { headers: auth })
    const { session: before } = await s1.json() as { session: { total: number; items: { stateId: string; cardId: string; mode: string }[] } }
    expect(before.total).toBe(1)
    expect(before.items[0].mode).toBe('new')
    const item = before.items[0]

    const p1 = await app.request(`/tracks/${trackId}/plan`, { headers: auth })
    const { plan: planBefore } = await p1.json() as { plan: { newRemaining: number; total: number } }
    expect(planBefore.newRemaining).toBe(1)
    expect(planBefore.total).toBe(1)

    // 정답 제출
    const ans = await app.request(`/tracks/${trackId}/session/answer`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ stateId: item.stateId, cardId: item.cardId, answer: 'a' }),
    })
    expect(ans.status).toBe(200)

    // 다음 세션: 빈 큐 (정답 카드는 미래로 밀려 오늘 대상 아님)
    const s2 = await app.request(`/tracks/${trackId}/session`, { headers: auth })
    const { session: after } = await s2.json() as { session: { total: number } }
    expect(after.total).toBe(0)

    // 다음 플랜: newRemaining 1→0 (총 카드 수는 유지)
    const p2 = await app.request(`/tracks/${trackId}/plan`, { headers: auth })
    const { plan: planAfter } = await p2.json() as { plan: { newRemaining: number; total: number } }
    expect(planAfter.newRemaining).toBe(0)
    expect(planAfter.total).toBe(1)
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
