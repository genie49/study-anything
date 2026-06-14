// 자기설명 코치 채점 정책 — 표현의 독창성이 아니라 "핵심을 맞게 담았는가"만 본다.
// 핵심을 그대로(복붙) 옮겨도 내용이 맞으면 통과해야 한다(사용자 피드백: 깐깐함 완화).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { gradeSelfExplanation } from './explain.js'

function captureFetch(verdict: { sufficient: boolean; feedback: string }) {
  const spy = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', spy)
  return spy
}

function sentSystemInstruction(spy: ReturnType<typeof captureFetch>): string {
  const body = JSON.parse(spy.mock.calls[0][1]!.body as string)
  return body.systemInstruction.parts.map((p: { text: string }) => p.text).join(' ')
}

const concept = { title: '현재완료', bodyMd: '과거의 일이 현재까지 이어진다', elaboration: '기간의 시제' }

afterEach(() => vi.unstubAllGlobals())

describe('gradeSelfExplanation 채점 정책', () => {
  it('채점 기준은 핵심의 정확성이며, 표현의 독창성·재서술을 요구하지 않는다', async () => {
    const spy = captureFetch({ sufficient: true, feedback: '좋아요.' })
    await gradeSelfExplanation(concept, '과거의 일이 현재까지 이어진다', { apiKey: 'k', model: 'm', timeoutMs: 1000 })
    const instr = sentSystemInstruction(spy)

    // 복붙/그대로 옮긴 설명도 핵심이 맞으면 통과시키라는 지시가 명시돼야 한다.
    expect(instr).toMatch(/복붙|그대로|복사|동일|verbatim/)
    // "자신의 언어로 다시 써야 통과"라는 식의 독창성 요구가 채점 기준이 되어선 안 된다.
    expect(instr).not.toMatch(/자신의 언어로 (쓴|써야|정리)/)
  })

  it('LLM 평결을 그대로 전달한다(통과/미통과)', async () => {
    captureFetch({ sufficient: true, feedback: 'ok' })
    expect((await gradeSelfExplanation(concept, '설명', { apiKey: 'k', model: 'm', timeoutMs: 1000 })).sufficient).toBe(true)
    vi.unstubAllGlobals()
    captureFetch({ sufficient: false, feedback: '보완' })
    expect((await gradeSelfExplanation(concept, '설명', { apiKey: 'k', model: 'm', timeoutMs: 1000 })).sufficient).toBe(false)
  })
})
