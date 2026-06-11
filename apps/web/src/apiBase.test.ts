import { describe, it, expect, vi } from 'vitest'

async function loadApiBase(value: string) {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', value)
  return import('./apiBase')
}

describe('API base URL', () => {
  it('removes trailing slashes from VITE_API_URL', async () => {
    const { API, hasBackend } = await loadApiBase('https://api-production-443d.up.railway.app///')
    expect(API).toBe('https://api-production-443d.up.railway.app')
    expect(hasBackend).toBe(true)
  })

  it('keeps demo mode when VITE_API_URL is empty', async () => {
    const { API, hasBackend } = await loadApiBase('')
    expect(API).toBe('')
    expect(hasBackend).toBe(false)
  })
})
