// Upstash Redis REST client.
// Used for short-lived OAuth state and access-token denylist entries.
type RedisCommand = Array<string | number>
type UpstashResponse<T> = { result?: T; error?: string }

class UpstashRedis {
  constructor(private readonly url: string, private readonly token: string) {}

  private async command<T>(command: RedisCommand): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(command),
    })
    if (!res.ok) throw new Error(`Upstash Redis ${res.status} ${res.statusText}`)

    const body = await res.json() as UpstashResponse<T>
    if (body.error) throw new Error(body.error)
    return body.result as T
  }

  async ping(): Promise<string> {
    return this.command<string>(['PING'])
  }

  async set(key: string, value: string, mode?: 'EX', seconds?: number): Promise<string> {
    const command: RedisCommand = mode === 'EX' && seconds ? ['SET', key, value, mode, seconds] : ['SET', key, value]
    return this.command<string>(command)
  }

  async get(key: string): Promise<string | null> {
    return this.command<string | null>(['GET', key])
  }

  async del(key: string): Promise<number> {
    return this.command<number>(['DEL', key])
  }

  async exists(key: string): Promise<number> {
    return this.command<number>(['EXISTS', key])
  }
}

let redis: UpstashRedis | null = null

export async function connectRedis(): Promise<UpstashRedis> {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required')

  redis = new UpstashRedis(url, token)
  await redis.ping()
  console.log('[redis] connected to upstash rest')
  return redis
}

export function getRedis(): UpstashRedis {
  if (!redis) throw new Error('Redis not connected — connectRedis()를 먼저 호출하세요')
  return redis
}
