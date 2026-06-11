// 인증 라우트 — /auth/google, /callback, /refresh, /logout, /me. auth.md.
import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { randomUUID } from 'node:crypto'
import { config } from '../config'
import { signAccess, signRefresh, verifyAccess, verifyRefresh } from './jwt'
import { createAuthRequest, handleCallback } from './google'
import { upsertUser, getUser, storeRefresh, consumeRefresh, revokeFamily, denyAccess } from './store'
import { requireAuth, type AuthVars } from '../middleware/auth'

const REFRESH_COOKIE = 'refresh'

function setRefreshCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true, secure: config.isProd, sameSite: 'Lax',
    path: '/auth', maxAge: config.refreshTtlSec,
  })
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
      deleteCookie(c, REFRESH_COOKIE, { path: '/auth' })
      return c.json({ error: r === 'reuse' ? 'token reuse detected' : 'invalid refresh' }, 401)
    }
    const out = await issueSession(c, p.sub, p.family) // family 유지
    return c.json(out)
  } catch {
    deleteCookie(c, REFRESH_COOKIE, { path: '/auth' })
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
  deleteCookie(c, REFRESH_COOKIE, { path: '/auth' })
  return c.json({ ok: true })
})

// 현재 사용자
auth.get('/me', requireAuth, async (c) => {
  const u = await getUser(c.get('userId'))
  if (!u) return c.json({ error: 'not found' }, 404)
  return c.json({ id: String(u._id), email: u.email, name: u.name, picture: u.picture })
})
