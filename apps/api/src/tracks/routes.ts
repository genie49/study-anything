// 트랙 라우트 — import / 수정(이름·시험일) / 삭제. 전부 인증 필수(JWT→userId).
// auth.md / data-pipeline §3 / frontend-screens.md(#3·#14·위험구역).
import { Hono, type Context } from 'hono'
import { requireAuth, type AuthVars } from '../middleware/auth'
import { validateBundle, importBundle, type SoulBundle } from './import'
import { bundleFromZip } from './unzip'
import { validateTrackPatch, updateTrack, deleteTrack, listTracks, type TrackPatch } from './manage'
import { getTrackPlan } from './plan'
import { getSessionQueue, submitSessionAnswer, type AnswerInput } from './session'

export const tracks = new Hono<{ Variables: AuthVars }>()

// 트랙 목록(홈 #1) — 저장 필드만.
tracks.get('/', requireAuth, async (c) => {
  const list = await listTracks(c.get('userId'))
  return c.json({ ok: true, tracks: list })
})

// 트랙 일일 플랜(대시보드 #2) — cardStates에서 런타임 재계산(무동결).
tracks.get('/:id/plan', requireAuth, async (c) => {
  const plan = await getTrackPlan(c.get('userId'), c.req.param('id') ?? '')
  if (!plan) return c.json({ error: 'track not found' }, 404)
  return c.json({ ok: true, plan })
})

// 오늘 학습 세션 큐 — 실제 카드/개념 콘텐츠를 반환. 상태 갱신은 제출 API에서 처리한다.
tracks.get('/:id/session', requireAuth, async (c) => {
  const queue = await getSessionQueue(c.get('userId'), c.req.param('id') ?? '')
  if (!queue) return c.json({ error: 'track not found' }, 404)
  return c.json({ ok: true, session: queue })
})

// 세션 답안 제출 — 현재는 exact/mcq 결정적 채점으로 상태 갱신. LLM 채점은 다음 증분.
tracks.post('/:id/session/answer', requireAuth, async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON body' }, 400) }
  const b = body as Partial<AnswerInput>
  if (!b.stateId || !b.cardId || typeof b.answer !== 'string') {
    return c.json({ error: 'invalid answer', errors: ['stateId, cardId, answer required'] }, 400)
  }
  const result = await submitSessionAnswer(c.get('userId'), c.req.param('id') ?? '', {
    stateId: b.stateId,
    cardId: b.cardId,
    answer: b.answer,
    elapsedMs: typeof b.elapsedMs === 'number' ? b.elapsedMs : undefined,
  })
  if (!result) return c.json({ error: 'card not found' }, 404)
  return c.json({ ok: true, result })
})

// 업로드된 zip(멀티파트 'file' 또는 raw 바디)을 풀어 bundle로. 실패 시 에러 문자열 배열.
async function bundleFromRequestZip(c: Context<{ Variables: AuthVars }>): Promise<{ bundle?: SoulBundle; errors: string[] }> {
  const ct = c.req.header('content-type') ?? ''
  let bytes: Uint8Array
  if (ct.includes('multipart/form-data')) {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) return { errors: ["multipart 'file' 필드(zip)가 필요합니다"] }
    bytes = new Uint8Array(await file.arrayBuffer())
  } else {
    bytes = new Uint8Array(await c.req.arrayBuffer()) // application/zip | octet-stream 등 raw
  }
  if (!bytes.length) return { errors: ['빈 업로드'] }
  return bundleFromZip(bytes)
}

// 트랙 import — .soul 번들 적재.
//   - application/json: { manifest, decks } 직접(CLI/하위호환)
//   - multipart/form-data 또는 zip raw: 업로드된 .soul.zip을 서버에서 압축 해제(앱 #13)
// 어느 경로든 같은 결정적 importBundle로 수렴.
tracks.post('/import', requireAuth, async (c) => {
  const ct = c.req.header('content-type') ?? ''
  let bundle: unknown

  if (ct.includes('application/json')) {
    try { bundle = await c.req.json() } catch { return c.json({ error: 'invalid JSON body' }, 400) }
  } else {
    const { bundle: b, errors } = await bundleFromRequestZip(c)
    if (errors.length) return c.json({ error: 'invalid zip bundle', errors }, 400)
    bundle = b
  }

  const errors = validateBundle(bundle)
  if (errors.length) return c.json({ error: 'invalid soul bundle', errors }, 400)

  const userId = c.get('userId')
  try {
    const summary = await importBundle(userId, bundle as SoulBundle)
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
