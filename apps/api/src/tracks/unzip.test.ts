// zip → SoulBundle 조립 테스트. fflate.zipSync로 pack_soul.py 레이아웃을 모사.
import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { bundleFromZip } from './unzip'
import { validateBundle } from './import'

const MANIFEST = { soulVersion: 1, trackSlug: '토익', title: '토익', decks: [{ slug: 'd1', title: 'Deck 1', order: 1 }] }
const DECK = {
  deckSlug: 'd1',
  concepts: [{ conceptKey: 'pp', title: '현재완료', bodyMd: '## 핵심', order: 1,
    cards: [{ cardKey: 'c1', type: 'qa', prompt: 'q', answer: 'a', explanation: 'e', difficultyPrior: 0.3 }] }],
}

// pack_soul.py 출력과 같은 루트 레이아웃: manifest.json + decks/{slug}.json.
function makeZip(opts: { manifest?: unknown; decks?: Record<string, unknown>; wrapDir?: string } = {}): Uint8Array {
  const manifest = opts.manifest ?? MANIFEST
  const decks = opts.decks ?? { d1: DECK }
  const tree: Record<string, Uint8Array> = { 'manifest.json': strToU8(JSON.stringify(manifest)) }
  for (const [slug, payload] of Object.entries(decks)) tree[`decks/${slug}.json`] = strToU8(JSON.stringify(payload))
  if (opts.wrapDir) {
    const wrapped: Record<string, Uint8Array> = {}
    for (const [k, v] of Object.entries(tree)) wrapped[`${opts.wrapDir}/${k}`] = v
    return zipSync(wrapped)
  }
  return zipSync(tree)
}

describe('bundleFromZip', () => {
  it('정상 zip → bundle 조립 + validateBundle 통과', () => {
    const { bundle, errors } = bundleFromZip(makeZip())
    expect(errors).toEqual([])
    expect(bundle?.manifest.trackSlug).toBe('토익')
    expect(bundle?.decks).toHaveLength(1)
    expect(bundle?.decks[0].concepts[0].cards[0].cardKey).toBe('c1')
    expect(validateBundle(bundle)).toEqual([])
  })

  it('단일 래핑 디렉토리(토익/…) 관용 — 벗겨서 조립', () => {
    const { bundle, errors } = bundleFromZip(makeZip({ wrapDir: '토익' }))
    expect(errors).toEqual([])
    expect(bundle?.decks).toHaveLength(1)
  })

  it('manifest 없음 → 에러', () => {
    const z = zipSync({ 'decks/d1.json': strToU8('{}') })
    expect(bundleFromZip(z).errors.some((e) => e.includes('manifest.json 없음'))).toBe(true)
  })

  it('manifest가 가리키는 deck 파일 누락 → 에러', () => {
    const { errors } = bundleFromZip(makeZip({ decks: {} })) // d1 파일 빠짐
    expect(errors.some((e) => e.includes('decks/d1.json 없음'))).toBe(true)
  })

  it('깨진 zip → 해제 실패 에러', () => {
    expect(bundleFromZip(new Uint8Array([1, 2, 3, 4])).errors.some((e) => e.includes('zip 해제 실패'))).toBe(true)
  })

  it('manifest JSON 깨짐 → 파싱 실패 에러', () => {
    const z = zipSync({ 'manifest.json': strToU8('{ not json') })
    expect(bundleFromZip(z).errors.some((e) => e.includes('파싱 실패'))).toBe(true)
  })
})
