// 자기설명("왜?") 코치 — 개념 본문·모범 설명을 기준으로 학습자의 자기설명이 핵심을 담았는지
// LLM이 판단하고 한국어 피드백을 준다. learning-algorithm-detail.md §2(인코딩) · learning-science-research.md.
// 카드 채점기(grader.ts)와 같은 Gemini 패턴을 쓰되, 참조는 정답이 아니라 개념의 elaboration(모범 자기설명)이다.
import { config } from '../config.js'

export type ExplainConcept = { title?: string; bodyMd?: string; elaboration?: string }
export type ExplainFeedback = {
  sufficient: boolean   // 핵심을 담았는가(다지기로 넘어갈 준비)
  feedback: string      // 한국어 1~2문장 격려·보완
  mode: 'llm' | 'skipped'
}
export type ExplainOptions = { apiKey?: string; model?: string; timeoutMs?: number }

function parseGeminiJson(body: unknown): { sufficient: boolean; feedback: string } {
  const text = (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    .candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('missing Gemini text')
  const parsed = JSON.parse(text) as { sufficient?: unknown; feedback?: unknown }
  return {
    sufficient: parsed.sufficient === true,
    feedback: typeof parsed.feedback === 'string' && parsed.feedback.trim()
      ? parsed.feedback.trim()
      : '설명을 확인했어요.',
  }
}

async function llmExplain(concept: ExplainConcept, explanation: string, opts: Required<ExplainOptions>): Promise<ExplainFeedback> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(opts.timeoutMs),
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{
          text: JSON.stringify({
            task: 'coach a self-explanation',
            lang: 'ko',
            conceptTitle: concept.title ?? '',
            conceptBody: concept.bodyMd ?? '',
            modelExplanation: concept.elaboration ?? '',
            learnerExplanation: explanation,
          }),
        }],
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            sufficient: { type: 'boolean' },
            feedback: { type: 'string' },
          },
          required: ['sufficient', 'feedback'],
        },
      },
      systemInstruction: {
        parts: [{
          text: [
            '너는 학습앱의 자기설명 코치다.',
            '오직 한 가지만 채점한다: 학습자의 "왜?" 설명이 개념의 핵심 원리/구분을 맞게 담았는가.',
            '표현의 독창성·재서술 여부는 채점 대상이 아니다. 학습자가 본문이나 모범 설명을 그대로(복붙/동일 문구로) 옮겼더라도 핵심이 맞으면 sufficient=true.',
            '"네 언어로 다시 정리하라"는 요구로 통과를 막지 마라. 채점은 관대하게 — 핵심 인과나 구분이 들어 있으면 통과다.',
            '오직 핵심이 빠졌거나 틀렸을 때만 sufficient=false로 하고, 무엇을 한 줄 보태면 좋을지 짚어준다.',
            '한국어 1~2문장 feedback(격려 + 구체적 보완점). 반드시 JSON만 반환한다.',
          ].join(' '),
        }],
      },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const { sufficient, feedback } = parseGeminiJson(await res.json())
  return { sufficient, feedback, mode: 'llm' }
}

export async function gradeSelfExplanation(concept: ExplainConcept, explanation: string, options: ExplainOptions = {}): Promise<ExplainFeedback> {
  const apiKey = options.apiKey ?? config.grader.apiKey
  const model = options.model ?? config.grader.model
  const timeoutMs = options.timeoutMs ?? config.grader.timeoutMs
  if (apiKey) {
    try {
      return await llmExplain(concept, explanation, { apiKey, model, timeoutMs })
    } catch {
      // LLM 장애는 학습을 막지 않는다 — 판정 불가 시 통과 처리(mode:'skipped')로 강등한다.
      // 게이트는 이 통과를 영속화하지 않으므로(explain.ts) 다음 세션에 다시 적용된다.
    }
  }
  return { sufficient: true, feedback: '설명을 기록했어요. 바로 다지기로 넘어가도 좋아요.', mode: 'skipped' }
}
