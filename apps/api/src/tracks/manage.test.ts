// 트랙 수정·삭제 로직 통합 테스트 — 인메모리 Mongo. seed는 importBundle 재사용.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { connectMongo, closeMongo, getDb } from '../db/mongo.js'
import { importBundle, type SoulBundle } from './import.js'
import { validateTrackPatch, updateTrack, deleteTrack, listTracks } from './manage.js'

let mongod: MongoMemoryServer
const USER = 'user-manage-1'
const OTHER = 'user-manage-2'

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGO_URL = mongod.getUri('study')
  await connectMongo()
}, 60_000)
afterAll(async () => { await closeMongo(); await mongod?.stop() })

function bundle(): SoulBundle {
  return {
    manifest: { soulVersion: 1, trackSlug: '토익', title: '토익', decks: [{ slug: 'd1', title: 'Deck 1', order: 1 }] },
    decks: [{
      deckSlug: 'd1',
      concepts: [{
        conceptKey: 'pp', title: '현재완료', bodyMd: '## 핵심', order: 1,
        cards: [{ cardKey: 'c1', type: 'qa', prompt: 'q', answer: 'a', explanation: 'e', difficultyPrior: 0.3 }],
      }],
    }],
  }
}

// 한 유저의 트랙을 seed하고 trackId 반환(+ reviewLog/session 흔적 추가).
async function seedTrack(userId: string): Promise<string> {
  const { trackId } = await importBundle(userId, bundle())
  const db = getDb()
  const _id = new ObjectId(trackId)
  await db.collection('reviewLogs').insertOne({ userId, trackId: _id, cardId: new ObjectId(), ts: new Date(), grade: 'good' })
  await db.collection('sessions').insertOne({ userId, trackId: _id, startedAt: new Date(), completed: 1 })
  return trackId
}

beforeEach(async () => {
  await getDb().dropDatabase()
})

describe('validateTrackPatch', () => {
  it('빈 패치 거부', () => { expect(validateTrackPatch({}).length).toBeGreaterThan(0) })
  it('잘못된 날짜 거부', () => { expect(validateTrackPatch({ examDate: 'not-a-date' }).some((e) => e.includes('examDate'))).toBe(true) })
  it('빈 title 거부', () => { expect(validateTrackPatch({ title: '  ' }).some((e) => e.includes('title'))).toBe(true) })
  it('정상 패치(시험일)', () => { expect(validateTrackPatch({ examDate: '2026-07-15' })).toEqual([]) })
  it('examDate null 허용(해제)', () => { expect(validateTrackPatch({ examDate: null })).toEqual([]) })
})

describe('updateTrack', () => {
  it('시험일 설정 — examDate 영속화 + view 반환(#14)', async () => {
    const trackId = await seedTrack(USER)
    const view = await updateTrack(USER, trackId, { examDate: '2026-07-15' })
    expect(view?.examDate).toBe(new Date('2026-07-15').toISOString())

    const doc = await getDb().collection('tracks').findOne({ _id: new ObjectId(trackId) })
    expect(doc?.examDate).toBeInstanceOf(Date)
  })

  it('이름 수정(#3) — trim 적용', async () => {
    const trackId = await seedTrack(USER)
    const view = await updateTrack(USER, trackId, { title: '  토익 RC  ' })
    expect(view?.title).toBe('토익 RC')
  })

  it('다른 유저의 트랙은 수정 불가(404 → null)', async () => {
    const trackId = await seedTrack(USER)
    expect(await updateTrack(OTHER, trackId, { title: '탈취' })).toBeNull()
    // 원본 불변
    const doc = await getDb().collection('tracks').findOne({ _id: new ObjectId(trackId) })
    expect(doc?.title).toBe('토익')
  })

  it('잘못된 ObjectId → null', async () => {
    expect(await updateTrack(USER, 'not-an-id', { title: 'x' })).toBeNull()
  })
})

describe('listTracks', () => {
  it('새 유저는 빈 목록', async () => {
    expect(await listTracks('nobody')).toEqual([])
  })

  it('내 트랙만 — userId 스코프 + 저장 필드(examDate ISO)', async () => {
    const trackId = await seedTrack(USER)
    await seedTrack(OTHER) // 격리 확인용
    await updateTrack(USER, trackId, { examDate: '2026-07-15' })

    const list = await listTracks(USER)
    expect(list).toHaveLength(1)
    expect(list[0].trackSlug).toBe('토익')
    expect(list[0].examDate).toBe(new Date('2026-07-15').toISOString())
    expect(list[0]).not.toHaveProperty('health') // 파생값 없음(dumb read)
  })
})

describe('deleteTrack', () => {
  it('cascade — 트랙 + 자식 전부 영구 삭제', async () => {
    const trackId = await seedTrack(USER)
    const db = getDb()
    const _id = new ObjectId(trackId)
    // 사전: 자식 존재
    expect(await db.collection('cards').countDocuments({ trackId: _id })).toBe(1)

    const summary = await deleteTrack(USER, trackId)
    expect(summary?.deleted.tracks).toBe(1)
    expect(summary?.deleted.cards).toBe(1)

    // 사후: 전부 0
    for (const col of ['tracks', 'decks', 'concepts', 'cards', 'cardStates', 'reviewLogs', 'sessions']) {
      const q = col === 'tracks' ? { _id } : { trackId: _id }
      expect(await db.collection(col).countDocuments(q)).toBe(0)
    }
  })

  it('다른 유저의 트랙은 삭제 불가 + 데이터 보존', async () => {
    const trackId = await seedTrack(USER)
    expect(await deleteTrack(OTHER, trackId)).toBeNull()
    const db = getDb()
    expect(await db.collection('tracks').countDocuments({ _id: new ObjectId(trackId) })).toBe(1)
    expect(await db.collection('cards').countDocuments({ trackId: new ObjectId(trackId) })).toBe(1)
  })

  it('잘못된 ObjectId → null', async () => {
    expect(await deleteTrack(USER, 'not-an-id')).toBeNull()
  })

  it('한 유저의 다른 트랙은 건드리지 않음', async () => {
    const t1 = await seedTrack(USER)
    // 두 번째 트랙(다른 slug)
    const b2 = bundle(); b2.manifest.trackSlug = '오픽'; b2.manifest.title = '오픽'
    const { trackId: t2 } = await importBundle(USER, b2)

    await deleteTrack(USER, t1)
    const db = getDb()
    expect(await db.collection('tracks').countDocuments({ _id: new ObjectId(t2) })).toBe(1)
    expect(await db.collection('cards').countDocuments({ trackId: new ObjectId(t2) })).toBe(1)
  })
})
