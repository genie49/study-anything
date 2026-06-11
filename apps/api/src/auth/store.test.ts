// 영속 경로 통합 테스트 — 인메모리 Mongo로 구글 없이 검증.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { connectMongo, closeMongo, getDb } from '../db/mongo.js'
import { upsertUser, storeRefresh, consumeRefresh } from './store.js'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGO_URL = mongod.getUri('study')
  await connectMongo()
}, 60_000)

afterAll(async () => {
  await closeMongo()
  await mongod?.stop()
})

const future = () => Math.floor(Date.now() / 1000) + 3600

describe('upsertUser', () => {
  it('신규 생성 후 같은 googleSub는 같은 id로 갱신', async () => {
    const id1 = await upsertUser({ sub: 'g-123', email: 'a@gmail.com', name: '구', picture: 'p1' })
    expect(id1).toBeTruthy()
    const id2 = await upsertUser({ sub: 'g-123', email: 'a2@gmail.com', name: '구2', picture: 'p2' })
    expect(id2).toBe(id1) // upsert — 동일 사용자

    const doc = await getDb().collection('users').findOne({ googleSub: 'g-123' })
    expect(doc?.email).toBe('a2@gmail.com') // 갱신됨
    expect(doc?.name).toBe('구2')
    const count = await getDb().collection('users').countDocuments({ googleSub: 'g-123' })
    expect(count).toBe(1) // 중복 생성 없음
  })
})

describe('refresh 회전·재사용 탐지', () => {
  it('정상 소비 → ok, 재소비 → reuse + family 전체 취소', async () => {
    const userId = 'u-1', family = 'fam-A'
    const tokA = 'tokenA', tokB = 'tokenB'
    await storeRefresh(userId, 'jti-A', family, tokA, future())
    await storeRefresh(userId, 'jti-B', family, tokB, future()) // 같은 family의 다른 토큰

    // 처음 소비: ok
    expect(await consumeRefresh(tokA, 'jti-A', family)).toBe('ok')

    // 같은 토큰 재소비(이미 revoked): reuse → family 전체 취소
    expect(await consumeRefresh(tokA, 'jti-A', family)).toBe('reuse')

    // family의 다른 토큰(B)도 취소됐는지
    const bDoc = await getDb().collection('refreshTokens').findOne({ jti: 'jti-B' })
    expect(bDoc?.revokedAt).not.toBeNull()
  })

  it('없는 토큰은 missing', async () => {
    expect(await consumeRefresh('nope', 'jti-X', 'fam-Z')).toBe('missing')
  })
})
