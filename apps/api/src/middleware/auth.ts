// 인증 미들웨어 — Bearer access 검증 + denylist 확인 → userId 주입. auth.md.
import type { Context, Next } from 'hono'
import { verifyAccess } from '../auth/jwt'
import { isDenied } from '../auth/store'

export type AuthVars = { userId: string }

export async function requireAuth(c: Context<{ Variables: AuthVars }>, next: Next) {
  const h = c.req.header('Authorization') ?? ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : ''
  if (!token) return c.json({ error: 'unauthorized' }, 401)
  try {
    const p = await verifyAccess(token)
    if (await isDenied(p.jti)) return c.json({ error: 'token revoked' }, 401)
    c.set('userId', p.sub)
    await next()
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }
}
