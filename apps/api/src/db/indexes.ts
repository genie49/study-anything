// 인덱스 생성 — data-model.md §4. 멱등(createIndex는 동일 정의면 no-op).
// boot 경로에서만 호출(server.ts). 테스트는 connectMongo만 쓰므로 비용 없음.
import { getDb } from './mongo.js'

export async function ensureIndexes(): Promise<void> {
  const db = getDb()
  await Promise.all([
    db.collection('tracks').createIndex({ userId: 1, status: 1 }),
    db.collection('decks').createIndex({ trackId: 1, order: 1 }),
    db.collection('concepts').createIndex({ trackId: 1, deckId: 1, order: 1 }),
    db.collection('cards').createIndex({ conceptId: 1 }),
    db.collection('cards').createIndex({ trackId: 1 }),
    db.collection('cardStates').createIndex({ userId: 1, trackId: 1, dueAt: 1 }), // ★ 스케줄러 주 쿼리
    db.collection('cardStates').createIndex({ userId: 1, trackId: 1, stage: 1 }),
    db.collection('cardStates').createIndex({ userId: 1, trackId: 1, triaged: 1 }),
    db.collection('reviewLogs').createIndex({ trackId: 1, ts: -1 }),
    db.collection('reviewLogs').createIndex({ cardId: 1, ts: -1 }),
    db.collection('trackSnapshots').createIndex({ userId: 1, trackId: 1, day: 1 }, { unique: true }), // 하루 1건 upsert
    // 인증 — googleSub 유니크(중복 사용자 race 방지), refresh 해시 유니크 + TTL 자동만료
    db.collection('users').createIndex({ googleSub: 1 }, { unique: true }),
    db.collection('users').createIndex({ email: 1 }),
    db.collection('refreshTokens').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('refreshTokens').createIndex({ userId: 1 }),
    db.collection('refreshTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }), // TTL
  ])
  console.log('[mongo] indexes ensured')
}
