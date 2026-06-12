// 자기설명 피드백 로더 — 개념을 DB에서 찾아 LLM 코치(grading/explain)에 넘긴다.
// session.ts와 같은 패턴: DB 접근은 여기서, 판정은 순수 모듈에서.
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { gradeSelfExplanation, type ExplainFeedback } from '../grading/explain.js'

export async function getExplanationFeedback(
  userId: string,
  trackId: string,
  conceptId: string,
  explanation: string,
  now = new Date(),
): Promise<ExplainFeedback | null> {
  if (!ObjectId.isValid(trackId) || !ObjectId.isValid(conceptId)) return null
  const db = getDb()
  const _id = new ObjectId(conceptId)
  const _trackId = new ObjectId(trackId)
  const concept = await db.collection('concepts').findOne({ _id, userId, trackId: _trackId })
  if (!concept) return null
  const feedback = await gradeSelfExplanation({
    title: concept.title as string | undefined,
    bodyMd: concept.bodyMd as string | undefined,
    elaboration: concept.elaboration as string | undefined,
  }, explanation)
  // 다지기 게이트 통과 영속화 — LLM이 실제로 통과 판정한 경우에만 기록한다.
  // 키 미설정/LLM 장애 폴백(mode:'skipped', sufficient:true)은 진짜 통과가 아니므로 마킹하지 않는다.
  // → 일시 장애로 영구 통과가 찍혀 게이트가 무력화되는 것을 막는다(다음 세션에 다시 게이트 적용).
  if (feedback.mode === 'llm' && feedback.sufficient && !concept.selfExplainedAt) {
    await db.collection('concepts').updateOne({ _id, userId, trackId: _trackId }, { $set: { selfExplainedAt: now } })
  }
  return feedback
}
