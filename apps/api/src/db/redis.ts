import Redis from 'ioredis'

// Redis 용도(설계): on-demand 파생값의 집계 캐시(진도 누계 등),
// 향후 채점 LLM 레이트리밋 / 세션 토큰 저장. (data-model §0.1 참조)
let redis: Redis | null = null

export async function connectRedis(): Promise<Redis> {
  if (redis) return redis
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 })
  await redis.connect()
  console.log('[redis] connected')
  return redis
}

export function getRedis(): Redis {
  if (!redis) throw new Error('Redis not connected — connectRedis()를 먼저 호출하세요')
  return redis
}
