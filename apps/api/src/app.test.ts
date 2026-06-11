import { describe, it, expect } from 'vitest'
import app from './app.js'

describe('GET /health', () => {
  it('returns ok (서버 없이 app.request로 검증)', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, service: 'study-anything-api' })
  })
})
