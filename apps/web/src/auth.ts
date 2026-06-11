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
