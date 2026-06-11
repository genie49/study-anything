import './env.js' // .env 로드 — config 평가 전에 가장 먼저
import { serve } from '@hono/node-server'
import app from './app.js'
import { connectMongo } from './db/mongo.js'
import { connectRedis } from './db/redis.js'
import { ensureIndexes } from './db/indexes.js'

const port = Number(process.env.PORT ?? 8787)

// 부팅 시 인프라 연결 시도(실패해도 서버는 떠서 /health는 응답).
void connectMongo()
  .then(ensureIndexes)
  .catch((e) => console.error('[mongo]', (e as Error).message))
void connectRedis().catch((e) => console.error('[redis]', (e as Error).message))

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on :${info.port}`)
})
