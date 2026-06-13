// 풀스크린 학습 세션 — screens-session.jsx 이식.
import { useState } from 'react'
import { WF, TONE, type Tone } from '../design/tokens'
import { Screen, Body, Card, Chip, Bar, Btn, Marker } from '../design/kit'
import type { AnswerResult, ExplainFeedback, SessionItem } from '../api'

function SessHead({ done, total, right, onClose }: { done: number; total: number; right?: string; onClose?: () => void }) {
  return (
    <div style={{ flex: '0 0 auto', padding: '6px 18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span onClick={onClose} style={{ fontSize: 19, color: WF.ink2, lineHeight: 1, cursor: 'pointer' }}>✕</span>
        <div style={{ flex: 1 }}><Bar pct={total ? (done / total) * 100 : 0} dark h={6} /></div>
        <span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink2, minWidth: 42, textAlign: 'right' }}>
          {right || `${done}/${total}`}
        </span>
      </div>
    </div>
  )
}

// 7. 사전테스트
export function S_Pretest({ onClose }: { onClose?: () => void }) {
  return (
    <Screen>
      <SessHead done={0} total={42} right="새 개념" onClose={onClose} />
      <Body gap={0} style={{ paddingTop: 26 }}>
        <Chip tone="neutral">사전테스트</Chip>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 18, lineHeight: 1.35 }}>먼저 추측해보세요</div>
        <div style={{ fontSize: 14, color: WF.ink2, marginTop: 6 }}>틀려도 괜찮아요</div>
        <div style={{ marginTop: 34, fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>미래완료의 형태는?</div>
        <div style={{ marginTop: 18, border: `1px solid ${WF.line}`, borderRadius: 12, padding: '15px 14px', color: WF.ink3, fontSize: 15 }}>답 입력…</div>
        <div style={{ marginTop: 18 }}><Btn primary>확인하기</Btn></div>
      </Body>
    </Screen>
  )
}

// 4. 개념 + 자기설명 게이트
function plainMd(s: string): string {
  return s.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim()
}

export function S_Concept({ item, done = 0, total = 42, passed = false, onClose, onNext, onExplain }: {
  item?: SessionItem; done?: number; total?: number; onClose?: () => void; onNext?: () => void
  // 이미 자기설명 게이트를 통과한 개념인가(통과분은 바로 다지기로 진행 가능).
  passed?: boolean
  // 백엔드 모드에서만 제공 — 실제 LLM 자기설명 피드백. 미제공이면(데모) 목업 렌더.
  onExplain?: (explanation: string) => Promise<ExplainFeedback>
}) {
  const [text, setText] = useState('')
  const [fb, setFb] = useState<ExplainFeedback | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const demo = !onExplain
  // 게이트: 백엔드 모드 + 미통과 개념은 LLM 통과 전까지 다지기로 못 넘어간다.
  // 이미 통과(passed)했거나 이번에 통과(fb.sufficient)하면 진행 가능. 데모는 게이트 없음.
  const gateActive = !demo && !passed
  const passedNow = passed || (fb?.sufficient ?? false)
  const canProceed = !gateActive || (fb?.sufficient ?? false)
  const conceptTitle = item?.conceptTitle ?? '현재완료 vs 과거시제'
  const conceptBody = item ? plainMd(item.conceptBodyMd) : '현재완료는 과거의 사건이 지금에 영향을 줄 때. 과거시제는 현재와 단절된 한 시점.'

  const requestFeedback = async () => {
    if (!onExplain || !text.trim() || loading) return
    setLoading(true); setErr(null)
    try { setFb(await onExplain(text.trim())) }
    catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <Screen>
      <SessHead done={done} total={total} onClose={onClose} />
      <Body gap={0} style={{ paddingTop: 22 }}>
        <Chip tone="neutral">개념</Chip>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.3 }}>{conceptTitle}</div>
          {passedNow && (
            <span title="자기설명 통과" style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 11, background: TONE.ok.bg, color: TONE.ok.c, border: `1px solid ${TONE.ok.c}`, fontSize: 13, fontWeight: 800, lineHeight: 1 }}>✓</span>
          )}
        </div>
        <div style={{ marginTop: 18, fontSize: 14.5, lineHeight: 1.65, color: WF.ink }}>
          <b>핵심.</b> {conceptBody}
        </div>
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
            개념을 자신의 언어로 설명해 보아요 <span style={{ color: WF.ink3, fontWeight: 400 }}>· 왜 그런가요?</span>
          </div>
          {demo ? (
            // 데모 전용 목업(백엔드 없을 때). 실제 학습 경로는 아래 인터랙티브 분기로 동작한다.
            <>
              <div style={{ border: `1px solid ${WF.lineStrong}`, borderRadius: 12, padding: '13px 14px', color: WF.ink, fontSize: 13.5, lineHeight: 1.55, minHeight: 56 }}>
                현재완료는 과거 일이 지금까지 이어지는 거고, 과거형은 그냥 끝난 일이에요.
              </div>
              <div style={{ marginTop: 10, border: `1px solid ${TONE.ok.c}`, background: TONE.ok.bg, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Marker tone="ok" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>좋아요! 핵심을 짚었어요</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={loading}
                placeholder="직접 설명해보세요…"
                style={{
                  width: '100%', minHeight: 56, border: `1px solid ${WF.lineStrong}`, borderRadius: 12,
                  padding: '13px 14px', fontSize: 13.5, lineHeight: 1.55, color: WF.ink, background: WF.paper,
                  fontFamily: WF.sans, resize: 'none', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ marginTop: 10 }}>
                <Btn ghost sm full disabled={!text.trim() || loading} onClick={() => { void requestFeedback() }}>
                  {loading ? '피드백 받는 중…' : fb ? '다시 피드백 받기' : '피드백 받기'}
                </Btn>
              </div>
              {err && <div style={{ marginTop: 8, fontSize: 12.5, color: TONE.danger.c, lineHeight: 1.45 }}>{err}</div>}
              {fb && (
                <div style={{ marginTop: 10, border: `1px solid ${fb.sufficient ? TONE.ok.c : TONE.warn.c}`, background: fb.sufficient ? TONE.ok.bg : TONE.warn.bg, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                    <Marker tone={fb.sufficient ? 'ok' : 'warn'} />
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{fb.sufficient ? '좋아요! 핵심을 짚었어요' : '조금 더 보태볼까요?'}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: WF.ink2, lineHeight: 1.5 }}>{fb.feedback}</div>
                </div>
              )}
            </>
          )}
        </div>
        {/* 게이트: 미통과 개념은 자기설명이 LLM 통과 판정을 받아야 다지기로 넘어갈 수 있다.
            이미 통과한 개념이거나 데모 모드면 바로 진행 가능. */}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          {gateActive && !canProceed && (
            <div style={{ fontSize: 12.5, color: WF.ink3, textAlign: 'center', marginBottom: 10, lineHeight: 1.5 }}>
              먼저 개념을 자신의 언어로 설명하고 피드백을 통과하면 다지기를 시작할 수 있어요.
            </div>
          )}
          <Btn primary disabled={!canProceed} onClick={onNext}>다지기 시작 ›</Btn>
        </div>
      </Body>
    </Screen>
  )
}

// 힌트 — 기본 숨김, "힌트 보기" 클릭 시 펼침. 힌트가 없으면 가짜 버튼을 띄우지 않고 아예 숨긴다.
function HintReveal({ hint }: { hint?: string | null }) {
  const [open, setOpen] = useState(false)
  if (!hint) return null
  return (
    <div style={{ marginTop: 18 }}>
      {open ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, color: WF.ink2, fontSize: 13, lineHeight: 1.55 }}>
          <span style={{ fontSize: 14, flex: '0 0 auto' }}>💡</span><span>{hint}</span>
        </div>
      ) : (
        <span onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: WF.ink3, fontSize: 13, cursor: 'pointer' }}>
          <span style={{ fontSize: 14 }}>💡</span><span style={{ borderBottom: `1px dashed ${WF.lineStrong}` }}>힌트 보기</span>
        </span>
      )}
    </div>
  )
}

// 오류 문제를 영구 제외하는 "다시 안 보기" 텍스트 버튼. 실수 방지를 위해 1회 확인 후 실행.
function SuspendLink({ onSuspend }: { onSuspend?: () => void }) {
  const [armed, setArmed] = useState(false)
  if (!onSuspend) return null
  return (
    <div style={{ marginTop: 16, textAlign: 'center' }}>
      {armed ? (
        <span style={{ fontSize: 12.5, color: WF.ink2 }}>
          이 문제를 다시 보지 않을까요?{' '}
          <span onClick={onSuspend} style={{ color: TONE.danger.c, fontWeight: 700, cursor: 'pointer' }}>제외</span>
          {' · '}
          <span onClick={() => setArmed(false)} style={{ color: WF.ink3, cursor: 'pointer' }}>취소</span>
        </span>
      ) : (
        <span onClick={() => setArmed(true)} style={{ fontSize: 12.5, color: WF.ink3, cursor: 'pointer' }}>
          🚫 이 문제 다시 안 보기
        </span>
      )}
    </div>
  )
}

// 5. 다지기 (입력형)
export function S_Quiz({ item, done = 24, total = 42, submitting = false, error, onClose, onSubmit, onSuspend }: {
  item?: SessionItem; done?: number; total?: number; submitting?: boolean; error?: string | null; onClose?: () => void; onSubmit?: (answer: string) => void; onSuspend?: () => void
}) {
  const [answer, setAnswer] = useState(item ? '' : 'has lived')
  const canSubmit = answer.trim().length > 0 && !submitting
  return (
    <Screen>
      <SessHead done={done} total={total} onClose={onClose} />
      <Body gap={0} style={{ paddingTop: 22 }}>
        <Chip tone="neutral">다지기 · {item?.conceptTitle ?? '현재완료'}</Chip>
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 26, lineHeight: 1.5 }}>
          {item?.prompt ?? <>He <span style={{ borderBottom: `2px solid ${WF.ink}`, padding: '0 26px' }}>&nbsp;</span> (live) here since 2010.</>}
        </div>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitting}
          placeholder="답 입력…"
          style={{
            marginTop: 30, width: '100%', minHeight: 54, border: `1px solid ${WF.lineStrong}`, borderRadius: 12,
            padding: '15px 14px', fontSize: 16, fontWeight: 500, color: WF.ink, background: WF.paper,
            fontFamily: WF.sans, resize: 'none', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: TONE.danger.c, lineHeight: 1.45 }}>{error}</div>}
        <div style={{ marginTop: 14 }}><Btn primary disabled={!canSubmit} onClick={() => onSubmit?.(answer)}>{submitting ? '채점 중…' : '제출'}</Btn></div>
        <HintReveal hint={item ? item.hint : '현재완료는 since/for와 함께 「현재까지 이어짐」을 나타내요.'} />
        <SuspendLink onSuspend={onSuspend} />
      </Body>
    </Screen>
  )
}

// 보기 순서를 마운트 시 1회 무작위로 섞는다(Fisher–Yates). 재방문 시 위치가 달라져 위치 암기를 막는다.
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

// 5b. 다지기 (mcq) — 정답+오답을 보기로 띄우고, 고른 보기를 즉시 제출(클릭 즉시 채점).
export function S_QuizMcq({ item, done = 24, total = 42, submitting = false, error, onClose, onSubmit, onSuspend }: {
  item?: SessionItem; done?: number; total?: number; submitting?: boolean; error?: string | null; onClose?: () => void; onSubmit?: (answer: string) => void; onSuspend?: () => void
}) {
  // 정답+오답을 한 번만 섞어 고정(리렌더로 위치가 바뀌지 않게 useState initializer 사용).
  const [options] = useState(() => shuffled(item ? [item.answer, ...item.distractors] : ['will have p.p.', 'will be p.p.', 'have been ~ing', 'had p.p.']))
  const [picked, setPicked] = useState<string | null>(null)
  const choose = (o: string) => {
    if (submitting || picked !== null) return
    setPicked(o)
    onSubmit?.(o)
  }
  return (
    <Screen>
      <SessHead done={done} total={total} onClose={onClose} />
      <Body gap={0} style={{ paddingTop: 22 }}>
        <Chip tone="neutral">다지기 · {item?.conceptTitle ?? 'mcq'}</Chip>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 24, lineHeight: 1.5 }}>{item?.prompt ?? '미래완료의 올바른 형태는?'}</div>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {options.map((o, i) => {
            const active = picked === o
            return (
              <div
                key={o}
                onClick={() => choose(o)}
                style={{
                  border: `1px solid ${active ? WF.ink : WF.line}`, borderRadius: 11, padding: '14px 16px', fontSize: 15,
                  display: 'flex', alignItems: 'center', gap: 12, lineHeight: 1.5,
                  cursor: submitting || picked !== null ? 'default' : 'pointer',
                  background: active ? WF.fill1 : WF.paper, opacity: picked !== null && !active ? 0.55 : 1,
                }}
              >
                <span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink3, flex: '0 0 auto' }}>{String.fromCharCode(65 + i)}</span>{o}
              </div>
            )
          })}
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: TONE.danger.c, lineHeight: 1.45 }}>{error}</div>}
        <HintReveal hint={item ? item.hint : null} />
        <SuspendLink onSuspend={onSuspend} />
      </Body>
    </Screen>
  )
}

// 5c. 채점 지연 (선접수-후채점)
export function S_Grading({ onClose }: { onClose?: () => void }) {
  return (
    <Screen>
      <SessHead done={26} total={42} onClose={onClose} />
      <Body gap={0} style={{ paddingTop: 22 }}>
        <Chip tone="neutral">다지기 · 다음 카드</Chip>
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 26, lineHeight: 1.5 }}>
          They <span style={{ borderBottom: `2px solid ${WF.ink}`, padding: '0 26px' }}>&nbsp;</span> (finish) by noon.
        </div>
        <div style={{ marginTop: 30, border: `1px solid ${WF.line}`, borderRadius: 12, padding: '15px 14px', color: WF.ink3, fontSize: 15 }}>답 입력…</div>
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 10, border: `1px dashed ${WF.line}`, borderRadius: 10, padding: '11px 13px', background: WF.fill1 }}>
          <span style={{ width: 12, height: 12, borderRadius: 8, border: `2px solid ${WF.ink3}`, borderTopColor: WF.ink, flex: '0 0 auto' }} />
          <span style={{ fontSize: 12.5, color: WF.ink2 }}>이전 문항 <b>채점 중…</b> 도착 시 결과 패치</span>
        </div>
      </Body>
    </Screen>
  )
}

// 6. 채점 결과
export function S_Grade({ answerResult, done = 25, total = 42, result = 'partial', onClose, onNext, onSuspend }: {
  answerResult?: AnswerResult; done?: number; total?: number; result?: 'correct' | 'partial' | 'wrong'; onClose?: () => void; onNext?: () => void; onSuspend?: () => void
}) {
  const R: Record<string, { tone: Tone; score: string; fill: number; label: string; reason: string }> = {
    correct: { tone: 'ok', score: '1.0', fill: 100, label: '정답', reason: '시제와 since 뒤 기간 해석까지 정확해요.' },
    partial: { tone: 'warn', score: '0.7', fill: 70, label: '부분정답', reason: '"시제는 맞았으나 since 뒤 기간 해석이 빠졌어요"' },
    wrong: { tone: 'danger', score: '0.0', fill: 0, label: '오답', reason: '"과거형(lived)을 썼어요. since+기간은 현재완료가 필요해요"' },
  }
  const derived = answerResult
    ? (answerResult.score >= 0.85 ? 'correct' : answerResult.score >= 0.5 ? 'partial' : 'wrong')
    : result
  const r = R[derived]
  const t = TONE[r.tone]
  const selIdx = { correct: 2, partial: 1, wrong: 0 }[derived]
  const score = answerResult ? answerResult.score.toFixed(1) : r.score
  const reason = answerResult?.reason ?? r.reason
  const referenceAnswer = answerResult?.answer ?? 'has lived'
  const explanation = answerResult?.explanation ?? 'since + 기간 → 현재완료. 과거형은 현재와 단절됩니다.'
  const modeLabel = 'LLM 채점'
  return (
    <Screen>
      <SessHead done={done} total={total} onClose={onClose} />
      <Body gap={0} style={{ paddingTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(${t.c} 0 ${r.fill}%, ${WF.fill2} ${r.fill}% 100%)` }}>
            <span style={{ width: 44, height: 44, borderRadius: 22, background: WF.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: WF.mono, fontSize: 16, fontWeight: 700 }}>{score}</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Marker tone={r.tone} /><span style={{ fontSize: 18, fontWeight: 700 }}>{r.label}</span>
            </div>
            <div style={{ fontFamily: WF.mono, fontSize: 11, color: WF.ink3, marginTop: 3 }}>score {score} · {modeLabel}</div>
          </div>
        </div>
        <div style={{ marginTop: 18, fontSize: 14.5, lineHeight: 1.6, padding: '13px 14px', background: t.bg, border: `1px solid ${t.c}`, borderRadius: 12, color: WF.ink }}>{reason}</div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: WF.ink2 }}>정답</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>{referenceAnswer}</div>
          <div style={{ fontSize: 13, color: WF.ink2, marginTop: 12 }}>해설</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 3, color: WF.ink }}>{explanation}</div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, color: WF.ink3, marginBottom: 8, fontFamily: WF.mono }}>자가 등급 보정 (선택)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
            {([['다시', 'danger'], ['어려움', 'warn'], ['좋음', 'ok'], ['쉬움', 'cool']] as [string, Tone][]).map(([g, gt], i) => (
              <div key={g} style={{ padding: '10px 0', fontSize: 12.5, borderRadius: 9, border: `1px solid ${TONE[gt].c}`, background: i === selIdx ? TONE[gt].bg : 'transparent', color: WF.ink, fontWeight: i === selIdx ? 700 : 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Marker tone={gt} size={7} />{g}
              </div>
            ))}
          </div>
        </div>
        <SuspendLink onSuspend={onSuspend} />
        <div style={{ marginTop: 'auto', paddingTop: 16 }}><Btn primary onClick={onNext}>다음 ›</Btn></div>
      </Body>
    </Screen>
  )
}

// 8. 세션 완료 요약
function shortDueLabel(dueAt?: string): string {
  if (!dueAt) return '대기 중'
  const d = new Date(dueAt)
  if (Number.isNaN(d.getTime())) return '대기 중'
  const now = new Date()
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diff = Math.round((dueDay - today) / 86400000)
  if (diff <= 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff < 7) return `${diff}일 뒤`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function S_Summary({ results, completed = 42, correct, onReviewAgain, onDone }: {
  results?: AnswerResult[]; completed?: number; correct?: number; onReviewAgain?: () => void; onDone?: () => void
}) {
  const accuracy = correct == null || completed === 0 ? 81 : Math.round((correct / completed) * 100)
  const stats: [string, string][] = [[String(completed), '문항'], [`${accuracy}%`, '정답률'], ['-', '학습시간']]
  const counts = {
    again: results?.filter((r) => r.grade === 'again').length ?? 0,
    hard: results?.filter((r) => r.grade === 'hard').length ?? 0,
    good: results?.filter((r) => r.grade === 'good').length ?? 0,
    easy: results?.filter((r) => r.grade === 'easy').length ?? 0,
  }
  const reviewCount = counts.again + counts.hard
  const nextDue = results?.map((r) => r.dueAt).filter(Boolean).sort()[0]
  const gradeStats: [string, number, Tone][] = [
    ['다시', counts.again, 'danger'],
    ['어려움', counts.hard, 'warn'],
    ['좋음', counts.good, 'ok'],
    ['쉬움', counts.easy, 'cool'],
  ]
  return (
    <Screen>
      <Body style={{ paddingTop: 40, paddingLeft: 28, paddingRight: 28, gap: 0, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 34 }}>🎉</div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 10 }}>완료!</div>
        <div style={{ display: 'flex', gap: 30, marginTop: 26 }}>
          {stats.map(([v, l]) => (
            <div key={l}>
              <div style={{ fontFamily: WF.mono, fontSize: 22, fontWeight: 700 }}>{v}</div>
              <div style={{ fontSize: 11.5, color: WF.ink2, marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
        <Card style={{ width: '100%', marginTop: 30, textAlign: 'left', padding: '16px 18px' }}>
          <div style={{ fontSize: 12, color: WF.ink2, fontFamily: WF.mono, marginBottom: 12 }}>오늘 채점</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {gradeStats.map(([label, value, tone]) => (
              <div key={label} style={{ border: `1px solid ${TONE[tone].c}`, background: value > 0 ? TONE[tone].bg : WF.paper, borderRadius: 10, padding: '10px 0', textAlign: 'center' }}>
                <div style={{ fontFamily: WF.mono, fontSize: 18, fontWeight: 700 }}>{value}</div>
                <div style={{ fontSize: 11.5, color: WF.ink2, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ width: '100%', marginTop: 12, textAlign: 'left', padding: '15px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13.5, color: WF.ink2 }}>다음 복습</div>
            <div style={{ fontSize: 12, color: WF.ink3, marginTop: 3 }}>어려웠던 카드 {reviewCount}개</div>
          </div>
          <span style={{ fontFamily: WF.mono, fontSize: 14, fontWeight: 600 }}>{shortDueLabel(nextDue)}</span>
        </Card>
        <div style={{ marginTop: 'auto', width: '100%', paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {onReviewAgain && <Btn ghost onClick={onReviewAgain}>오답만 다시 풀기</Btn>}
          <Btn primary onClick={onDone}>대시보드로 ›</Btn>
        </div>
      </Body>
    </Screen>
  )
}
