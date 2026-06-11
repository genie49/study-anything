// /tracks/import 핵심 로직 통합 테스트 — 인메모리 Mongo, 구글 불필요.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { connectMongo, closeMongo, getDb } from '../db/mongo.js'
import { validateBundle, importBundle, type SoulBundle } from './import.js'

let mongod: MongoMemoryServer
const USER = 'user-import-1'

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGO_URL = mongod.getUri('study')
  await connectMongo()
}, 60_000)
afterAll(async () => { await closeMongo(); await mongod?.stop() })

function bundle(cardKeys = ['c1', 'c2']): SoulBundle {
  return {
    manifest: { soulVersion: 1, trackSlug: '토익', title: '토익', subjectType: 'language', decks: [{ slug: 'd1', title: 'Deck 1', order: 1 }] },
    examDate: '2026-07-15',
    decks: [{
      deckSlug: 'd1',
      concepts: [
        { conceptKey: 'pp-vs-past', title: '현재완료 vs 과거', bodyMd: '## 핵심', elaboration: '왜', order: 1, confusableWith: ['past-perfect'],
          cards: cardKeys.map((k) => ({ cardKey: k, type: 'cloze', prompt: 'He __ since 2010.', answer: 'has lived', explanation: '현재완료', difficultyPrior: 0.3 })) },
        { conceptKey: 'past-perfect', title: '과거완료', bodyMd: '## 본문', order: 2, cards: [{ cardKey: 'c3', type: 'qa', prompt: '?', answer: 'had p.p.', explanation: '해설', difficultyPrior: 0.5 }] },
      ],
    }],
  }
}

describe('validateBundle', () => {
  it('정상 번들은 에러 없음', () => { expect(validateBundle(bundle())).toEqual([]) })
  it('answer 누락 감지', () => {
    const b = bundle()
    delete (b.decks[0].concepts[0].cards[0] as { answer?: string }).answer
    expect(validateBundle(b).some((e) => e.includes('answer missing'))).toBe(true)
  })
  it('mcq distractors 누락 감지', () => {
    const b = bundle()
    b.decks[0].concepts[0].cards[0].type = 'mcq'
    expect(validateBundle(b).some((e) => e.includes('distractors'))).toBe(true)
  })
})

describe('importBundle', () => {
  it('최초 import — 컬렉션 생성 + userId 스코프 + confusableWith 해소', async () => {
    const s = await importBundle(USER, bundle())
    expect(s.concepts).toBe(2)
    expect(s.cards).toBe(3)
    expect(s.archived).toBe(0)

    const db = getDb()
    expect(await db.collection('tracks').countDocuments({ userId: USER, trackSlug: '토익' })).toBe(1)
    expect(await db.collection('cards').countDocuments({ userId: USER, status: 'active' })).toBe(3)
    expect(await db.collection('cardStates').countDocuments({ userId: USER, stage: 'new' })).toBe(3)

    // confusableWith가 conceptKey가 아니라 ObjectId로 해소됐는지
    const ppvp = await db.collection('concepts').findOne({ userId: USER, conceptKey: 'pp-vs-past' })
    const pp = await db.collection('concepts').findOne({ userId: USER, conceptKey: 'past-perfect' })
    expect(ppvp?.confusableWith?.[0]?.toString()).toBe(pp?._id?.toString())
  })

  it('재import — 멱등(트랙 1개) + 진도 보존', async () => {
    const db = getDb()
    // 진도 흔적 남기기
    const card = await db.collection('cards').findOne({ userId: USER, soulKey: 'c1' })
    await db.collection('cardStates').updateOne({ userId: USER, cardId: card!._id }, { $set: { reps: 7, stage: 'review' } })

    await importBundle(USER, bundle())
    expect(await db.collection('tracks').countDocuments({ userId: USER })).toBe(1)
    const st = await db.collection('cardStates').findOne({ userId: USER, cardId: card!._id })
    expect(st?.reps).toBe(7) // $setOnInsert라 기존 진도 안 덮어씀
    expect(st?.stage).toBe('review')
  })

  it('orphan soft-delete — 빠진 카드 + 진도 archived', async () => {
    const db = getDb()
    const s = await importBundle(USER, bundle(['c1'])) // c2 제거
    expect(s.archived).toBe(1)
    const c2 = await db.collection('cards').findOne({ userId: USER, soulKey: 'c2' })
    expect(c2?.status).toBe('archived')
    const st = await db.collection('cardStates').findOne({ userId: USER, cardId: c2!._id })
    expect(st?.archived).toBe(true)
  })

  it('대량 카드 import — bulk 경로로 cardStates까지 생성', async () => {
    const many = bundle(Array.from({ length: 120 }, (_, i) => `bulk-${i}`))
    many.manifest.trackSlug = '토익-bulk'
    many.manifest.title = '토익 bulk'

    const s = await importBundle(`${USER}-bulk`, many)
    expect(s.cards).toBe(121)

    const db = getDb()
    expect(await db.collection('cards').countDocuments({ userId: `${USER}-bulk`, status: 'active' })).toBe(121)
    expect(await db.collection('cardStates').countDocuments({ userId: `${USER}-bulk`, archived: false })).toBe(121)
  })
})
