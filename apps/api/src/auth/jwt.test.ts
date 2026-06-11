import { describe, it, expect } from 'vitest'
import { signAccess, signRefresh, verifyAccess, verifyRefresh } from './jwt.js'

describe('jwt', () => {
  it('access 토큰 왕복', async () => {
    const { token, jti } = await signAccess('u1')
    const p = await verifyAccess(token)
    expect(p.sub).toBe('u1')
    expect(p.jti).toBe(jti)
    expect(p.typ).toBe('access')
    expect(p.exp).toBeGreaterThan(p.iat)
  })

  it('refresh 토큰 왕복 + family 보존', async () => {
    const { token } = await signRefresh('u1', 'fam-1')
    const p = await verifyRefresh(token)
    expect(p.sub).toBe('u1')
    expect(p.family).toBe('fam-1')
    expect(p.typ).toBe('refresh')
  })

  it('access를 verifyRefresh로 검증하면 거부(typ 가드)', async () => {
    const { token } = await signAccess('u1')
    await expect(verifyRefresh(token)).rejects.toThrow()
  })
})
