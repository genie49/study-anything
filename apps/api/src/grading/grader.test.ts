import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gradeCardAnswer } from './grader.js'

const qa = { type: 'qa', prompt: 'q', answer: 'has lived', explanation: 'e' }

describe('gradeCardAnswer', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('apiKey가 없으면 관대 폴백(오답 강등 금지)', async () => {
    const r = await gradeCardAnswer(qa, '아무 답', { apiKey: '' })
    expect(r.mode).toBe('fallback')
    expect(r.grade).toBe('good')
    expect(r.correct).toBe(true)
  })

  it('mcq 정답 보기 선택 시 LLM 없이 동등비교로 정답 처리', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const r = await gradeCardAnswer({ type: 'mcq', answer: 'A', distractors: ['B', 'C'], explanation: 'e' }, 'A', { apiKey: 'k', model: 'm', timeoutMs: 1000 })
    expect(r.mode).toBe('mcq')
    expect(r.grade).toBe('good')
    expect(r.correct).toBe(true)
    expect(r.score).toBe(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mcq 오답 보기 선택 시 LLM 없이 동등비교로 오답 처리', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const r = await gradeCardAnswer({ type: 'mcq', answer: 'A', distractors: ['B', 'C'], explanation: 'e' }, 'B', { apiKey: 'k', model: 'm', timeoutMs: 1000 })
    expect(r.mode).toBe('mcq')
    expect(r.grade).toBe('again')
    expect(r.correct).toBe(false)
    expect(r.score).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mcq 동등비교는 앞뒤 공백을 무시한다', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const r = await gradeCardAnswer({ type: 'mcq', answer: '정답 보기', distractors: ['오답'], explanation: 'e' }, '  정답 보기  ', { apiKey: 'k', model: 'm', timeoutMs: 1000 })
    expect(r.mode).toBe('mcq')
    expect(r.correct).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
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

  it('Gemini 연속 실패 시 관대 폴백(오답 강등 금지)', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('nope', { status: 500 })))
    const r = await gradeCardAnswer(qa, 'wrong', { apiKey: 'k', model: 'm', timeoutMs: 1000 })
    expect(r.mode).toBe('fallback')
    expect(r.grade).toBe('good')
    expect(r.correct).toBe(true)
  })

  it('Gemini 1회 실패 후 재시도 성공', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ score: 1, reason: '정답이에요.' }) }] } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const r = await gradeCardAnswer(qa, 'has lived', { apiKey: 'k', model: 'm', timeoutMs: 1000 })
    expect(r.mode).toBe('llm')
    expect(r.grade).toBe('good')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
