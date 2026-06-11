// 트랙 라우트 — POST /tracks/import (인증 필수, JWT→userId). auth.md / data-pipeline §3.
import { Hono } from 'hono'
import { requireAuth, type AuthVars } from '../middleware/auth'
import { validateBundle, importBundle, type SoulBundle } from './import'

export const tracks = new Hono<{ Variables: AuthVars }>()

tracks.post('/import', requireAuth, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON body' }, 400) }

  const errors = validateBundle(body)
  if (errors.length) return c.json({ error: 'invalid soul bundle', errors }, 400)

  const userId = c.get('userId')
  try {
    const summary = await importBundle(userId, body as SoulBundle)
    return c.json({ ok: true, ...summary })
  } catch (e) {
    return c.json({ error: 'import failed', detail: (e as Error).message }, 500)
  }
})
