// 구글 OAuth (Authorization Code + PKCE) — google-auth-library. auth.md.
import { OAuth2Client } from 'google-auth-library'
import { randomBytes } from 'node:crypto'
import { config, assertGoogleConfigured } from '../config'
import { getRedis } from '../db/redis'
import type { GoogleProfile } from './store'

function client() {
  assertGoogleConfigured()
  return new OAuth2Client(config.google.clientId, config.google.clientSecret, config.google.redirectUri)
}

// 로그인 시작 — state/nonce/PKCE verifier를 Redis에 짧게 저장하고 authUrl 반환.
export async function createAuthRequest(): Promise<{ url: string; state: string }> {
  const c = client()
  const state = randomBytes(16).toString('hex')
  const nonce = randomBytes(16).toString('hex')
  const { codeVerifier, codeChallenge } = await c.generateCodeVerifierAsync()

  await getRedis().set(`oauth:${state}`, JSON.stringify({ codeVerifier, nonce }), 'EX', 600)

  const url = c.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    code_challenge_method: 'S256' as never,
    code_challenge: codeChallenge,
    nonce,
  })
  return { url, state }
}

// 콜백 — state 검증 → code 교환 → ID 토큰 검증 → 프로필.
export async function handleCallback(code: string, state: string): Promise<GoogleProfile> {
  const redis = getRedis()
  const raw = await redis.get(`oauth:${state}`)
  if (!raw) throw new Error('invalid or expired state')
  await redis.del(`oauth:${state}`) // 일회성
  const { codeVerifier, nonce } = JSON.parse(raw) as { codeVerifier: string; nonce: string }

  const c = client()
  const { tokens } = await c.getToken({ code, codeVerifier })
  if (!tokens.id_token) throw new Error('no id_token from google')

  const ticket = await c.verifyIdToken({ idToken: tokens.id_token, audience: config.google.clientId })
  const payload = ticket.getPayload()
  if (!payload) throw new Error('invalid id_token')
  if (payload.nonce !== nonce) throw new Error('nonce mismatch')

  return { sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture }
}
