import { Hono } from 'hono'

// Hono 앱 정의만 분리 → 테스트에서 서버를 띄우지 않고 app.request()로 검증.
export const app = new Hono()

app.get('/health', (c) =>
  c.json({ ok: true, service: 'study-anything-api' }),
)

export default app
