// 인증 플로우 E2E — Google 경계(./google)만 모킹, 나머지는 실제 코드 + 인메모리 Mongo.
// 콜백 → 세션발급 → refresh 회전 → 재사용 탐지까지 라우트로 검증. (Redis 불필요 경로만)
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'

// ./google 전체를 모킹 — 실제 구글 토큰교환 없이 캔드 프로필 반환.
vi.mock('./google', () => ({
  createAuthRequest: async () => ({ url: 'https://accounts.google.com/o/oauth2/v2/auth?mock', state: 'st' }),
  handleCallback: async () => ({ sub: 'google-sub-1', email: 'a@b.com', name: '홍길동', picture: 'http://p' }),
}))

import app from '../app'
import { connectMongo, closeMongo } from '../db/mongo'
import { ensureIndexes } from '../db/indexes'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGO_URL = mongod.getUri('study')
  await connectMongo()
  await ensureIndexes()
}, 60_000)
afterAll(async () => { await closeMongo(); await mongod?.stop() })

// Set-Cookie에서 refresh 토큰만 뽑아 Cookie 헤더로 되돌려줄 값 생성.
function refreshCookie(res: Response): string {
  const sc = res.headers.get('set-cookie') ?? ''
  const m = /refresh=([^;]+)/.exec(sc)
  if (!m) throw new Error('no refresh cookie in response')
  return `refresh=${m[1]}`
}

describe('auth flow (google 모킹)', () => {
  it('/auth/google → 구글 authUrl로 리다이렉트', async () => {
    const res = await app.request('/auth/google')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('accounts.google.com')
  })

  it('콜백 → 사용자 생성 + refresh 쿠키 + webOrigin 리다이렉트', async () => {
    const res = await app.request('/auth/google/callback?code=c&state=st')
    expect(res.status).toBe(302)
    expect(refreshCookie(res)).toMatch(/^refresh=/)
    // 사용자 upsert 됐는지
    const { getDb } = await import('../db/mongo')
    expect(await getDb().collection('users').countDocuments({ googleSub: 'google-sub-1' })).toBe(1)
  })

  it('회전 — refresh(R1)→R2 발급 + accessToken 반환', async () => {
    const cb = await app.request('/auth/google/callback?code=c&state=st')
    const r1 = refreshCookie(cb)
    const res = await app.request('/auth/refresh', { method: 'POST', headers: { cookie: r1 } })
    expect(res.status).toBe(200)
    const body = await res.json() as { accessToken: string; expiresIn: number }
    expect(body.accessToken).toBeTruthy()
    expect(body.expiresIn).toBeGreaterThan(0)
    expect(refreshCookie(res)).not.toBe(r1) // 새 토큰
  })

  it('재사용 탐지 — R1 두 번째 사용 → 401, family 폐기로 R2도 401', async () => {
    const cb = await app.request('/auth/google/callback?code=c&state=st')
    const r1 = refreshCookie(cb)
    const rot = await app.request('/auth/refresh', { method: 'POST', headers: { cookie: r1 } })
    const r2 = refreshCookie(rot)

    // R1 재사용 → 탈취 간주
    const reuse = await app.request('/auth/refresh', { method: 'POST', headers: { cookie: r1 } })
    expect(reuse.status).toBe(401)
    expect((await reuse.json() as { error: string }).error).toContain('reuse')

    // family 전체 폐기됐으므로 정상 발급됐던 R2도 무효
    const after = await app.request('/auth/refresh', { method: 'POST', headers: { cookie: r2 } })
    expect(after.status).toBe(401)
  })

  it('refresh 쿠키 없음 → 401', async () => {
    const res = await app.request('/auth/refresh', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})

// dev 게이트웨이(비프로덕션). 구글 우회 테스트 계정 로그인.
describe('POST /auth/dev/login (dev 전용)', () => {
  it('테스트 계정 세션 발급 — accessToken + refresh 쿠키 + user', async () => {
    const res = await app.request('/auth/dev/login', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json() as { accessToken: string; user: { email: string } }
    expect(body.accessToken).toBeTruthy()
    expect(body.user.email).toBe('dev@study-anything.test')
    expect(refreshCookie(res)).toBeTruthy() // refresh 쿠키 set

    // 발급된 access가 유효(서명 검증)하고 sub가 채워졌는지(Redis 불필요 — verifyAccess 직접)
    const { verifyAccess } = await import('./jwt')
    const payload = await verifyAccess(body.accessToken)
    expect(payload.sub).toBeTruthy()
  })

  it('재호출해도 같은 계정(중복 생성 없음)', async () => {
    await app.request('/auth/dev/login', { method: 'POST' })
    await app.request('/auth/dev/login', { method: 'POST' })
    const { getDb } = await import('../db/mongo')
    expect(await getDb().collection('users').countDocuments({ googleSub: 'dev-test-account' })).toBe(1)
  })
})
