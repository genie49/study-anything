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
  // 다지기 게이트 통과 영속화 — 한번 통과(sufficient)한 개념은 영구 기록해 다시 게이트가 걸리지 않게 한다.
  // LLM 장애 폴백(mode:'skipped')이라도 학습자가 비어있지 않은 자기설명을 제출하고 통과했으면 인정한다
  // (라우트가 빈 설명을 막는다). selfExplainedMode로 검증 여부를 남겨 추후 품질 구분에 쓴다.
  if (feedback.sufficient && !concept.selfExplainedAt) {
    await db.collection('concepts').updateOne(
      { _id, userId, trackId: _trackId },
      { $set: { selfExplainedAt: now, selfExplainedMode: feedback.mode } },
    )
  }
  return feedback
}
