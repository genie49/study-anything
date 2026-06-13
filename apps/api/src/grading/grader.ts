// 런타임 채점기 — 모든 유형을 Gemini LLM으로 채점한다(코드 동등비교 폐기).
// 사용자 요구: "채점은 모두 llm으로". exact 동등비교는 철자·동의어·패러프레이즈를 오답으로
// 과처리하므로 제거했다. LLM 호출 실패/키 부재 시에도 오답으로 강등하지 않고 관대하게 통과시킨다
// (false negative가 학습 동기를 해치는 쪽이 false positive보다 나쁘다 — 장애는 드물다).
import { config } from '../config.js'
import type { Grade } from '../scheduler/memory.js'

export type GraderMode = 'llm' | 'fallback' | 'mcq'

export type GradeableCard = {
  type?: string
  prompt?: string
  answer?: string
  explanation?: string
  distractors?: string[]
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

function scoreToGrade(score: number): Grade {
  if (score >= 0.85) return 'good'
  if (score >= 0.5) return 'hard'
  return 'again'
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return Math.max(0, Math.min(1, v))
}

// mcq는 클릭 선택이라 오타가 없다 → 선택지 동등비교로 즉시·무료·완전 일관하게 채점(LLM 호출 안 함).
// runtime-grading.md: card.type이 라우팅을 결정한다(mcq=동등비교, 그 외=LLM).
function mcqGrade(card: GradeableCard, learnerAnswer: string): GradedAnswer {
  const correct = (learnerAnswer ?? '').trim() === (card.answer ?? '').trim()
  return {
    score: correct ? 1 : 0,
    grade: correct ? 'good' : 'again',
    correct,
    mode: 'mcq',
    reason: correct ? '정답 보기를 골랐어요.' : `오답이에요. 정답은 「${card.answer ?? ''}」예요.`,
  }
}

// LLM을 쓸 수 없을 때(키 부재·연속 실패) 관대 폴백 — 오답으로 처리하지 않는다.
function lenientFallback(): GradedAnswer {
  return {
    score: 1,
    grade: 'good',
    correct: true,
    mode: 'fallback',
    reason: '채점기를 일시적으로 사용할 수 없어 정답으로 처리했어요. 정답·해설을 확인해 주세요.',
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
            type: card.type ?? 'qa',
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
            '너는 학습앱의 공정한 채점관이다.',
            '질문, 참조정답, 해설, 선택 채점기준, 학습자답변을 보고 0~1 점수를 매긴다.',
            '철자, 띄어쓰기, 동의어, 어순, 패러프레이즈는 관대하게 본다 — 의미가 통하면 정답이다.',
            '핵심 개념의 정오만 엄격하게 본다. 사소한 표기 차이로 깎지 마라.',
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
  // mcq는 LLM을 거치지 않고 선택지 동등비교로 즉시 채점한다.
  if (card.type === 'mcq') return mcqGrade(card, learnerAnswer)

  const apiKey = options.apiKey ?? config.grader.apiKey
  const model = options.model ?? config.grader.model
  const timeoutMs = options.timeoutMs ?? config.grader.timeoutMs
  if (!apiKey) return lenientFallback()

  const opts = { apiKey, model, timeoutMs }
  try {
    return await llmGrade(card, learnerAnswer, opts)
  } catch {
    // 일시적 장애일 수 있으니 1회 재시도 후에도 실패하면 관대 폴백(오답 강등 금지).
    try {
      return await llmGrade(card, learnerAnswer, opts)
    } catch {
      return lenientFallback()
    }
  }
}
