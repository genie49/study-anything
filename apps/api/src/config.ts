// 환경설정 — .env에서 로드. 시크릿은 서버에서만(auth.md).

export const config = {
  port: Number(process.env.PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  accessTtlSec: parseTtl(process.env.ACCESS_TTL ?? '15m'),
  refreshTtlSec: parseTtl(process.env.REFRESH_TTL ?? '30d'),
  grader: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GRADER_MODEL ?? 'gemini-3.1-flash-lite',
    timeoutMs: Number(process.env.GRADER_TIMEOUT_MS ?? 4000),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:8787/auth/google/callback',
  },
  isProd: process.env.NODE_ENV === 'production',
}

// "15m" | "30d" | "3600" → 초
export function parseTtl(s: string): number {
  const m = /^(\d+)([smhd])?$/.exec(s.trim())
  if (!m) return 900
  const n = Number(m[1])
  const unit = m[2]
  const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86400 : 1
  return n * mult
}

export function assertGoogleConfigured() {
  if (!config.google.clientId || !config.google.clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID/SECRET 미설정 — .env를 채우세요(auth.md)')
  }
}
