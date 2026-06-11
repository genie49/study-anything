// .soul zip → SoulBundle 조립. 프론트 ZIP 업로드(#13)의 서버측 입력 어댑터.
// pack_soul.py 레이아웃: zip 루트에 manifest.json + decks/{slug}.json.
// 결정적 upsert(importBundle)는 그대로 — 이 모듈은 zip을 풀어 bundle로 조립만 한다.
import { unzipSync, strFromU8 } from 'fflate'
import type { SoulBundle, SoulDeckPayload } from './import.js'

export type ZipResult = { bundle?: SoulBundle; errors: string[] }

// 사용자가 폴더째 압축해 단일 최상위 디렉토리로 감싼 경우(예: 토익/manifest.json) 벗긴다.
// 디렉토리 엔트리(끝 '/')는 무시. 루트에 manifest.json이 있으면 그대로.
function stripWrapper(files: Record<string, Uint8Array>): Record<string, Uint8Array> {
  if (files['manifest.json']) return files
  const names = Object.keys(files).filter((n) => !n.endsWith('/'))
  const tops = new Set(names.map((n) => n.split('/')[0]))
  if (tops.size === 1) {
    const prefix = `${[...tops][0]}/`
    const out: Record<string, Uint8Array> = {}
    for (const [k, v] of Object.entries(files)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v
    return out
  }
  return files
}

export function bundleFromZip(data: Uint8Array): ZipResult {
  let raw: Record<string, Uint8Array>
  try {
    raw = unzipSync(data)
  } catch (e) {
    return { errors: [`zip 해제 실패: ${(e as Error).message}`] }
  }
  const files = stripWrapper(raw)

  const manifestRaw = files['manifest.json']
  if (!manifestRaw) return { errors: ['manifest.json 없음 (zip 루트에 있어야 함)'] }

  let manifest: SoulBundle['manifest']
  try {
    manifest = JSON.parse(strFromU8(manifestRaw))
  } catch (e) {
    return { errors: [`manifest.json 파싱 실패: ${(e as Error).message}`] }
  }
  if (!manifest || !Array.isArray(manifest.decks) || manifest.decks.length === 0)
    return { errors: ['manifest.decks[] 없음/비어있음'] }

  // manifest.decks 순서대로 decks/{slug}.json을 읽어 평탄 배열로 조립.
  const decks: SoulDeckPayload[] = []
  const errors: string[] = []
  for (const d of manifest.decks) {
    const slug = d?.slug
    if (!slug) { errors.push('manifest.decks[].slug 누락'); continue }
    const deckRaw = files[`decks/${slug}.json`]
    if (!deckRaw) { errors.push(`decks/${slug}.json 없음`); continue }
    try {
      decks.push(JSON.parse(strFromU8(deckRaw)))
    } catch (e) {
      errors.push(`decks/${slug}.json 파싱 실패: ${(e as Error).message}`)
    }
  }
  if (errors.length) return { errors }
  return { bundle: { manifest, decks }, errors: [] }
}
