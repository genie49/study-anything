// JWT access/refresh 발급·검증 (HS256, hono/jwt). auth.md.
import { sign, verify } from 'hono/jwt'
import { randomUUID } from 'node:crypto'
import { config } from '../config.js'

export type AccessPayload = { sub: string; jti: string; typ: 'access'; exp: number; iat: number }
export type RefreshPayload = { sub: string; jti: string; family: string; typ: 'refresh'; exp: number; iat: number }

const nowSec = () => Math.floor(Date.now() / 1000)

export async function signAccess(userId: string): Promise<{ token: string; jti: string; exp: number }> {
  const iat = nowSec()
  const exp = iat + config.accessTtlSec
  const jti = randomUUID()
  const token = await sign({ sub: userId, jti, typ: 'access', iat, exp }, config.jwtSecret)
  return { token, jti, exp }
}

export async function signRefresh(userId: string, family: string): Promise<{ token: string; jti: string; exp: number }> {
  const iat = nowSec()
  const exp = iat + config.refreshTtlSec
  const jti = randomUUID()
  const token = await sign({ sub: userId, jti, family, typ: 'refresh', iat, exp }, config.jwtSecret)
  return { token, jti, exp }
}

export async function verifyAccess(token: string): Promise<AccessPayload> {
  const p = (await verify(token, config.jwtSecret, 'HS256')) as unknown as AccessPayload
  if (p.typ !== 'access') throw new Error('not an access token')
  return p
}

export async function verifyRefresh(token: string): Promise<RefreshPayload> {
  const p = (await verify(token, config.jwtSecret, 'HS256')) as unknown as RefreshPayload
  if (p.typ !== 'refresh') throw new Error('not a refresh token')
  return p
}
