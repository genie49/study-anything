import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gradeCardAnswer } from './grader'

const qa = { type: 'qa', prompt: 'q', answer: 'has lived', explanation: 'e' }

describe('gradeCardAnswer', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('mcq는 LLM 없이 동등비교', async () => {
    const r = await gradeCardAnswer({ type: 'mcq', answer: 'A', explanation: 'e' }, 'A', { apiKey: 'unused' })
    expect(r.mode).toBe('mcq')
    expect(r.grade).toBe('good')
    expect(r.score).toBe(1)
  })

  it('apiKey가 없으면 exact 폴백', async () => {
    const r = await gradeCardAnswer(qa, 'has lived', { apiKey: '' })
    expect(r.mode).toBe('exact')
    expect(r.grade).toBe('good')
  })

  it('Gemini JSON 점수를 grade로 매핑', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ score: 0.7, reason: '거의 맞지만 일부가 빠졌어요.' }) }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const r = await gradeCardAnswer(qa, 'has live', { apiKey: 'k', model: 'm', timeoutMs: 1000 })
    expect(r.mode).toBe('llm')
    expect(r.grade).toBe('hard')
    expect(r.score).toBe(0.7)
    expect(r.reason).toContain('거의')
  })

  it('Gemini 실패 시 exact 폴백', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('nope', { status: 500 })))
    const r = await gradeCardAnswer(qa, 'wrong', { apiKey: 'k', model: 'm', timeoutMs: 1000 })
    expect(r.mode).toBe('exact')
    expect(r.grade).toBe('again')
  })
})
