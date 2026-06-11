import { describe, it, expect } from 'vitest'
import { parseTtl } from './config.js'

describe('parseTtl', () => {
  it('단위 파싱', () => {
    expect(parseTtl('15m')).toBe(900)
    expect(parseTtl('30d')).toBe(2592000)
    expect(parseTtl('2h')).toBe(7200)
    expect(parseTtl('45s')).toBe(45)
    expect(parseTtl('3600')).toBe(3600)
  })
})
