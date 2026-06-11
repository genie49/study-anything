// 프론트 인증 클라이언트 — accessToken은 메모리 보관(auth.md).
// VITE_API_URL이 있으면 실제 백엔드와 통신, 없으면 데모(목업) 동작.
const API = import.meta.env.VITE_API_URL ?? ''
export const hasBackend = !!API

let accessToken: string | null = null
export const getAccessToken = () => accessToken

// 로그인 시작 → 백엔드 구글 OAuth로 리다이렉트
export function login() {
  window.location.href = `${API}/auth/google`
}

// dev 전용 — 구글 우회 테스트 로그인. VITE_DEV_LOGIN일 때만 노출(아래 플래그).
// 백엔드도 비프로덕션에서만 /auth/dev/login을 등록하므로 운영에선 동작 안 함.
export const devLoginEnabled = !!import.meta.env.VITE_DEV_LOGIN
export async function devLogin(): Promise<boolean> {
  if (!API) return false
  try {
    const res = await fetch(`${API}/auth/dev/login`, { method: 'POST', credentials: 'include' })
    if (!res.ok) return false
    const data = (await res.json()) as { accessToken?: string }
    accessToken = data.accessToken ?? null
    return !!accessToken
  } catch {
    return false
  }
}

// 앱 로드/401 시 refresh 쿠키로 access 침묵 재발급. 성공 시 true.
export async function tryRefresh(): Promise<boolean> {
  if (!API) return false
  try {
    const res = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (!res.ok) return false
    const data = (await res.json()) as { accessToken?: string }
    accessToken = data.accessToken ?? null
    return !!accessToken
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  if (API && accessToken) {
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST', credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch { /* noop */ }
  }
  accessToken = null
}
