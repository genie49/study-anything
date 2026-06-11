import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { config } from './config'
import { auth } from './auth/routes'
import type { AuthVars } from './middleware/auth'

// Hono 앱 정의만 분리 → 테스트에서 서버를 띄우지 않고 app.request()로 검증.
export const app = new Hono<{ Variables: AuthVars }>()

// 쿠키(refresh) 동봉을 위해 credentials 허용 + WEB_ORIGIN만.
app.use('*', cors({ origin: config.webOrigin, credentials: true }))

app.get('/health', (c) => c.json({ ok: true, service: 'study-anything-api' }))

app.route('/auth', auth)

export default app
