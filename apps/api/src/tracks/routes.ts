// 트랙 라우트 — import / 수정(이름·시험일) / 삭제. 전부 인증 필수(JWT→userId).
// auth.md / data-pipeline §3 / frontend-screens.md(#3·#14·위험구역).
import { Hono } from 'hono'
import { requireAuth, type AuthVars } from '../middleware/auth'
import { validateBundle, importBundle, type SoulBundle } from './import'
import { validateTrackPatch, updateTrack, deleteTrack, type TrackPatch } from './manage'

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

// 트랙 수정 — 이름·시험일(examDate)만. 화면 #3·#14가 호출.
tracks.patch('/:id', requireAuth, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON body' }, 400) }

  const errors = validateTrackPatch(body)
  if (errors.length) return c.json({ error: 'invalid patch', errors }, 400)

  const track = await updateTrack(c.get('userId'), c.req.param('id') ?? '', body as TrackPatch)
  if (!track) return c.json({ error: 'track not found' }, 404)
  return c.json({ ok: true, track })
})

// 트랙 삭제 — 영구(cascade). 위험구역 확인 시트가 호출.
tracks.delete('/:id', requireAuth, async (c) => {
  const summary = await deleteTrack(c.get('userId'), c.req.param('id') ?? '')
  if (!summary) return c.json({ error: 'track not found' }, 404)
  return c.json({ ok: true, ...summary })
})
