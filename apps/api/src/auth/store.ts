// 인증 영속 — users(upsert), refreshTokens(회전·취소), access denylist(redis). auth.md.
import { createHash } from 'node:crypto'
import { getDb } from '../db/mongo'
import { getRedis } from '../db/redis'

export type GoogleProfile = { sub: string; email?: string; name?: string; picture?: string }

const sha256 = (s: string) => 'sha256:' + createHash('sha256').update(s).digest('hex')

export async function upsertUser(p: GoogleProfile): Promise<string> {
  const db = getDb()
  const now = new Date()
  const res = await db.collection('users').findOneAndUpdate(
    { googleSub: p.sub },
    {
      $set: { email: p.email, name: p.name, picture: p.picture, lastLoginAt: now },
      $setOnInsert: { googleSub: p.sub, createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  )
  return String(res!._id)
}

export async function getUser(userId: string) {
  const { ObjectId } = await import('mongodb')
  return getDb().collection('users').findOne({ _id: new ObjectId(userId) })
}

// refreshTokens — 해시만 저장. 회전: 옛것 revoke, 새것 insert.
export async function storeRefresh(userId: string, jti: string, family: string, token: string, expSec: number) {
  await getDb().collection('refreshTokens').insertOne({
    userId, jti, family, tokenHash: sha256(token),
    createdAt: new Date(), expiresAt: new Date(expSec * 1000), revokedAt: null,
  })
}

// 회전 시 호출. 재사용 탐지: 이미 revoked면 family 전체 취소(탈취) → null 반환.
export async function consumeRefresh(token: string, jti: string, family: string): Promise<'ok' | 'reuse' | 'missing'> {
  const col = getDb().collection('refreshTokens')
  const doc = await col.findOne({ jti, tokenHash: sha256(token) })
  if (!doc) return 'missing'
  if (doc.revokedAt) {
    await col.updateMany({ family }, { $set: { revokedAt: new Date() } }) // 탈취 → family 폐기
    return 'reuse'
  }
  await col.updateOne({ jti }, { $set: { revokedAt: new Date() } })
  return 'ok'
}

export async function revokeFamily(family: string) {
  await getDb().collection('refreshTokens').updateMany({ family }, { $set: { revokedAt: new Date() } })
}

// access denylist (redis) — 로그아웃 시 jti를 만료까지 등록.
export async function denyAccess(jti: string, expSec: number) {
  const ttl = Math.max(1, expSec - Math.floor(Date.now() / 1000))
  await getRedis().set(`denylist:${jti}`, '1', 'EX', ttl)
}

export async function isDenied(jti: string): Promise<boolean> {
  return (await getRedis().exists(`denylist:${jti}`)) === 1
}
