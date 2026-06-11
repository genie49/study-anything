import { describe, it, expect } from 'vitest'

// 스캐폴드 스모크 테스트 — 테스트 러너(vitest)가 도는지 확인.
describe('web smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
