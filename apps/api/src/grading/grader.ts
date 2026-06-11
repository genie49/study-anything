// 런타임 채점기 — mcq는 결정적 비교, 나머지는 Gemini LLM 사용 후 실패 시 exact 폴백.
// runtime-grading.md: LLM은 참조정답/해설을 적용만 하며 콘텐츠를 생성하지 않는다.
import { config } from '../config.js'
import type { Grade } from '../scheduler/memory.js'

export type GraderMode = 'llm' | 'mcq' | 'exact'

export type GradeableCard = {
  type?: string
  prompt?: string
  answer?: string
  explanation?: string
  grading?: Record<string, unknown> | null
}

export type GradedAnswer = {
  score: number
  grade: Grade
  correct: boolean
  reason: string
  mode: GraderMode
}

export type GraderOptions = {
  apiKey?: string
  model?: string
  timeoutMs?: number
}

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function scoreToGrade(score: number): Grade {
  if (score >= 0.85) return 'good'
  if (score >= 0.5) return 'hard'
  return 'again'
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return Math.max(0, Math.min(1, v))
}

function exactGrade(card: GradeableCard, learnerAnswer: string, mode: GraderMode): GradedAnswer {
  const expected = normalizeAnswer(card.answer ?? '')
  const actual = normalizeAnswer(learnerAnswer)
  const correct = !!expected && actual === expected
  return {
    score: correct ? 1 : 0,
    grade: correct ? 'good' : 'again',
    correct,
    mode,
    reason: correct
      ? '정답이에요. 참조 정답과 일치합니다.'
      : '아직 달라요. 정답과 해설을 보고 다시 떠올려 보세요.',
  }
}

function parseGeminiJson(body: unknown): { score: number; reason: string } {
  const text = (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    .candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('missing Gemini text')
  const parsed = JSON.parse(text) as { score?: unknown; reason?: unknown }
  return {
    score: clampScore(parsed.score),
    reason: typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : '채점이 완료됐어요.',
  }
}

async function llmGrade(card: GradeableCard, learnerAnswer: string, opts: Required<GraderOptions>): Promise<GradedAnswer> {
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
            task: 'grade retrieval answer',
            lang: 'ko',
            question: card.prompt ?? '',
            referenceAnswer: card.answer ?? '',
            explanation: card.explanation ?? '',
            rubric: Array.isArray(card.grading?.rubric) ? card.grading?.rubric : [],
            learnerAnswer,
          }),
        }],
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            reason: { type: 'string' },
          },
          required: ['score', 'reason'],
        },
      },
      systemInstruction: {
        parts: [{
          text: [
            '너는 학습앱의 엄격하지만 공정한 채점관이다.',
            '질문, 참조정답, 해설, 선택 채점기준, 학습자답변을 보고 0~1 점수를 매긴다.',
            '철자, 띄어쓰기, 동의어, 패러프레이즈는 관대하게 보되 핵심 개념의 정오는 엄격하게 본다.',
            '한국어 1~2문장 reason을 준다. 반드시 JSON만 반환한다.',
          ].join(' '),
        }],
      },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const { score, reason } = parseGeminiJson(await res.json())
  return { score, reason, mode: 'llm', grade: scoreToGrade(score), correct: score >= 0.85 }
}

export async function gradeCardAnswer(card: GradeableCard, learnerAnswer: string, options: GraderOptions = {}): Promise<GradedAnswer> {
  if (card.type === 'mcq') return exactGrade(card, learnerAnswer, 'mcq')

  const apiKey = options.apiKey ?? config.grader.apiKey
  const model = options.model ?? config.grader.model
  const timeoutMs = options.timeoutMs ?? config.grader.timeoutMs
  if (apiKey) {
    try {
      return await llmGrade(card, learnerAnswer, { apiKey, model, timeoutMs })
    } catch {
      // LLM 장애는 학습을 막지 않는다. 결정적 exact 폴백으로 강등.
    }
  }
  return exactGrade(card, learnerAnswer, 'exact')
}
