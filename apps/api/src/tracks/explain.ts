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
): Promise<ExplainFeedback | null> {
  if (!ObjectId.isValid(trackId) || !ObjectId.isValid(conceptId)) return null
  const db = getDb()
  const concept = await db.collection('concepts').findOne({
    _id: new ObjectId(conceptId),
    userId,
    trackId: new ObjectId(trackId),
  })
  if (!concept) return null
  return gradeSelfExplanation({
    title: concept.title as string | undefined,
    bodyMd: concept.bodyMd as string | undefined,
    elaboration: concept.elaboration as string | undefined,
  }, explanation)
}
