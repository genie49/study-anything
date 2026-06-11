// 인증 라우트 — /auth/google, /callback, /refresh, /logout, /me. auth.md.
import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { signAccess, signRefresh, verifyAccess, verifyRefresh } from './jwt.js'
import { createAuthRequest, handleCallback } from './google.js'
import { upsertUser, getUser, storeRefresh, consumeRefresh, revokeFamily, denyAccess, type GoogleProfile } from './store.js'
import { requireAuth, type AuthVars } from '../middleware/auth.js'

const REFRESH_COOKIE = 'refresh'
const HINT_COOKIE = 'sa_session' // 읽기 가능(httpOnly 아님). 토큰 아님 — 프론트가 "세션 흔적"만 판별해 불필요한 refresh 401 방지.

function setRefreshCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true, secure: config.isProd, sameSite: 'Lax',
    path: '/auth', maxAge: config.refreshTtlSec,
  })
  // 힌트 쿠키 동반 — 프론트는 이게 있을 때만 /auth/refresh 호출.
  setCookie(c, HINT_COOKIE, '1', {
    httpOnly: false, secure: config.isProd, sameSite: 'Lax',
    path: '/', maxAge: config.refreshTtlSec,
  })
}

function clearAuthCookies(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, REFRESH_COOKIE, { path: '/auth' })
  deleteCookie(c, HINT_COOKIE, { path: '/' })
}

// refresh 발급(저장+쿠키) + access 발급. family 유지/신규.
async function issueSession(c: Parameters<typeof setCookie>[0], userId: string, family: string) {
  const r = await signRefresh(userId, family)
  await storeRefresh(userId, r.jti, family, r.token, r.exp)
  setRefreshCookie(c, r.token)
  const a = await signAccess(userId)
  return { accessToken: a.token, expiresIn: config.accessTtlSec }
}

export const auth = new Hono<{ Variables: AuthVars }>()

// 로그인 시작 → 구글로 리다이렉트
auth.get('/google', async (c) => {
  const { url } = await createAuthRequest()
  return c.redirect(url)
})

// 콜백 → 사용자 upsert → refresh 쿠키 set → 프론트로 리다이렉트(access는 /refresh로 취득)
auth.get('/google/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  if (!code || !state) return c.json({ error: 'missing code/state' }, 400)
  try {
    const profile = await handleCallback(code, state)
    const userId = await upsertUser(profile)
    await issueSession(c, userId, randomUUID())
    return c.redirect(config.webOrigin)
  } catch (e) {
    return c.json({ error: 'oauth failed', detail: (e as Error).message }, 401)
  }
})

// access 재발급(+refresh 회전). 쿠키 자동 동봉.
auth.post('/refresh', async (c) => {
  const token = getCookie(c, REFRESH_COOKIE)
  if (!token) return c.json({ error: 'no refresh' }, 401)
  try {
    const p = await verifyRefresh(token)
    const r = await consumeRefresh(token, p.jti, p.family)
    if (r !== 'ok') {
      clearAuthCookies(c)
      return c.json({ error: r === 'reuse' ? 'token reuse detected' : 'invalid refresh' }, 401)
    }
    const out = await issueSession(c, p.sub, p.family) // family 유지
    return c.json(out)
  } catch {
    clearAuthCookies(c)
    return c.json({ error: 'invalid refresh' }, 401)
  }
})

// 로그아웃 — access denylist + refresh family 취소 + 쿠키 삭제
auth.post('/logout', requireAuth, async (c) => {
  const h = c.req.header('Authorization') ?? ''
  const access = h.startsWith('Bearer ') ? h.slice(7) : ''
  try { const p = await verifyAccess(access); await denyAccess(p.jti, p.exp) } catch { /* noop */ }
  const rt = getCookie(c, REFRESH_COOKIE)
  if (rt) { try { const rp = await verifyRefresh(rt); await revokeFamily(rp.family) } catch { /* noop */ } }
  clearAuthCookies(c)
  return c.json({ ok: true })
})

// 현재 사용자
auth.get('/me', requireAuth, async (c) => {
  const u = await getUser(c.get('userId'))
  if (!u) return c.json({ error: 'not found' }, 404)
  return c.json({ id: String(u._id), email: u.email, name: u.name, picture: u.picture })
})

// ── dev 전용 게이트웨이 ────────────────────────────────────────────────────
// 구글을 우회해 고정 테스트 계정으로 세션을 발급한다. 자동화 E2E용(구글은 봇
// 로그인을 차단하므로). **운영(isProd)에선 라우트 자체를 등록하지 않는다.**
export const DEV_TEST_ACCOUNT: GoogleProfile = {
  sub: 'dev-test-account',
  email: 'dev@study-anything.test',
  name: 'Dev Tester',
}
if (!config.isProd) {
  auth.post('/dev/login', async (c) => {
    const userId = await upsertUser(DEV_TEST_ACCOUNT)
    const out = await issueSession(c, userId, randomUUID())
    return c.json({ ...out, user: { email: DEV_TEST_ACCOUNT.email, name: DEV_TEST_ACCOUNT.name } })
  })
}
