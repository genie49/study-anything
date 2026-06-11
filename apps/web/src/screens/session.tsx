// 풀스크린 학습 세션 — screens-session.jsx 이식.
import { useState } from 'react'
import { WF, TONE, type Tone } from '../design/tokens'
import { Screen, Body, Card, Chip, Bar, Btn, Marker } from '../design/kit'
import type { AnswerResult, SessionItem } from '../api'

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

export function S_Concept({ item, done = 0, total = 42, stage = 'input', onClose, onNext }: {
  item?: SessionItem; done?: number; total?: number; stage?: 'input' | 'insufficient' | 'ok'; onClose?: () => void; onNext?: () => void
}) {
  const ok = stage === 'ok'
  const low = stage === 'insufficient'
  const filled = ok || low
  const conceptTitle = item?.conceptTitle ?? '현재완료 vs 과거시제'
  const conceptBody = item ? plainMd(item.conceptBodyMd) : '현재완료는 과거의 사건이 지금에 영향을 줄 때. 과거시제는 현재와 단절된 한 시점.'
  return (
    <Screen>
      <SessHead done={done} total={total} onClose={onClose} />
      <Body gap={0} style={{ paddingTop: 22 }}>
        <Chip tone="neutral">개념</Chip>
        <div style={{ fontSize: 23, fontWeight: 700, marginTop: 16, lineHeight: 1.3 }}>{conceptTitle}</div>
        <div style={{ marginTop: 18, fontSize: 14.5, lineHeight: 1.65, color: WF.ink }}>
          <b>핵심.</b> {conceptBody}
        </div>
        <Card style={{ marginTop: 18, background: WF.fill1 }}>
          <div style={{ fontFamily: WF.mono, fontSize: 10.5, color: WF.ink3, marginBottom: 9, letterSpacing: '0.4px' }}>혼동쌍 · confusableWith</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, borderRight: `1px solid ${WF.line}`, paddingRight: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>have p.p.</div>
              <div style={{ fontSize: 12, color: WF.ink2, marginTop: 3 }}>지금까지의 영향</div>
            </div>
            <div style={{ flex: 1, paddingLeft: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>과거형</div>
              <div style={{ fontSize: 12, color: WF.ink2, marginTop: 3 }}>끝난 한 시점</div>
            </div>
          </div>
        </Card>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>개념을 자신의 언어로 설명해 보아요</div>
          <div style={{ border: `1px solid ${filled ? WF.lineStrong : WF.line}`, borderRadius: 12, padding: '13px 14px', color: filled ? WF.ink : WF.ink3, fontSize: 13.5, lineHeight: 1.55, minHeight: 56 }}>
            {filled ? '현재완료는 과거 일이 지금까지 이어지는 거고, 과거형은 그냥 끝난 일이에요.' : '직접 설명해보세요…'}
          </div>
          {!filled && <div style={{ marginTop: 10 }}><Btn ghost sm full>피드백 받기</Btn></div>}
          {low && (
            <div style={{ marginTop: 10, border: `1px solid ${TONE.warn.c}`, background: TONE.warn.bg, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <Marker tone="warn" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>조금 더 필요해요</span>
              </div>
              <div style={{ fontSize: 12.5, color: WF.ink2, lineHeight: 1.5 }}>'이어진다'는 맞아요. 과거형이 <b>현재와 단절</b>된다는 점을 한 줄 더 보태볼까요?</div>
              <div style={{ marginTop: 10 }}><Btn ghost sm full>다시 피드백 받기</Btn></div>
            </div>
          )}
          {ok && (
            <div style={{ marginTop: 10, border: `1px solid ${TONE.ok.c}`, background: TONE.ok.bg, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Marker tone="ok" /><span style={{ fontSize: 13.5, fontWeight: 700 }}>좋아요! 핵심을 짚었어요</span>
              </div>
              <div style={{ fontSize: 12.5, color: WF.ink2, lineHeight: 1.5, marginTop: 4 }}>이제 다지기로 넘어갈 수 있어요.</div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div>
            {ok
              ? <Btn primary onClick={onNext}>다지기 시작 ›</Btn>
              : <div style={{ textAlign: 'center', padding: '13px 18px', borderRadius: 10, background: WF.fill1, color: WF.ink3, fontSize: 15, fontWeight: 600, border: `1px solid ${WF.lineSoft}` }}>다지기 시작 ›</div>}
          </div>
        </div>
      </Body>
    </Screen>
  )
}

// 5. 다지기 (입력형)
export function S_Quiz({ item, done = 24, total = 42, onClose, onSubmit }: {
  item?: SessionItem; done?: number; total?: number; onClose?: () => void; onSubmit?: (answer: string) => void
}) {
  const [answer, setAnswer] = useState(item ? '' : 'has lived')
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
          placeholder="답 입력…"
          style={{
            marginTop: 30, width: '100%', minHeight: 54, border: `1px solid ${WF.lineStrong}`, borderRadius: 12,
            padding: '15px 14px', fontSize: 16, fontWeight: 500, color: WF.ink, background: WF.paper,
            fontFamily: WF.sans, resize: 'none', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ marginTop: 14 }}><Btn primary onClick={() => onSubmit?.(answer)}>제출</Btn></div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 7, color: WF.ink2, fontSize: 13 }}>
          <span style={{ fontSize: 14 }}>💡</span><span>{item?.hint ?? '힌트 보기'}</span>
        </div>
      </Body>
    </Screen>
  )
}

// 5b. 다지기 (mcq)
export function S_QuizMcq({ onClose }: { onClose?: () => void }) {
  return (
    <Screen>
      <SessHead done={24} total={42} onClose={onClose} />
      <Body gap={0} style={{ paddingTop: 22 }}>
        <Chip tone="neutral">다지기 · mcq</Chip>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 24, lineHeight: 1.5 }}>미래완료의 올바른 형태는?</div>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['will have p.p.', 'will be p.p.', 'have been ~ing', 'had p.p.'].map((o, i) => (
            <div key={o} style={{ border: `1px solid ${WF.line}`, borderRadius: 11, padding: '14px 16px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink3 }}>{String.fromCharCode(65 + i)}</span>{o}
            </div>
          ))}
        </div>
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
export function S_Grade({ answerResult, result = 'partial', onClose, onNext }: {
  answerResult?: AnswerResult; result?: 'correct' | 'partial' | 'wrong'; onClose?: () => void; onNext?: () => void
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
  return (
    <Screen>
      <SessHead done={25} total={42} onClose={onClose} />
      <Body gap={0} style={{ paddingTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(${t.c} 0 ${r.fill}%, ${WF.fill2} ${r.fill}% 100%)` }}>
            <span style={{ width: 44, height: 44, borderRadius: 22, background: WF.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: WF.mono, fontSize: 16, fontWeight: 700 }}>{score}</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Marker tone={r.tone} /><span style={{ fontSize: 18, fontWeight: 700 }}>{r.label}</span>
            </div>
            <div style={{ fontFamily: WF.mono, fontSize: 11, color: WF.ink3, marginTop: 3 }}>score {score} · {answerResult ? 'exact 채점' : 'LLM 채점'}</div>
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
        <div style={{ marginTop: 'auto', paddingTop: 16 }}><Btn primary onClick={onNext}>다음 ›</Btn></div>
      </Body>
    </Screen>
  )
}

// 8. 세션 완료 요약
export function S_Summary({ onDone }: { onDone?: () => void }) {
  const stats: [string, string][] = [['42', '문항'], ['81%', '정답률'], ['23분', '학습시간']]
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
          <div style={{ fontSize: 12, color: WF.ink2, fontFamily: WF.mono, marginBottom: 10 }}>시험당일 예측 · R(examDate)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
            <span style={{ fontSize: 14, color: WF.ink2 }}>목표 90%</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>현재 84% <span style={{ fontSize: 13, color: WF.ink2 }}>↑</span></span>
          </div>
          <Bar pct={84} dark />
        </Card>
        <Card style={{ width: '100%', marginTop: 12, textAlign: 'left', padding: '15px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13.5, color: WF.ink2 }}>다음 복습</span>
          <span style={{ fontFamily: WF.mono, fontSize: 14, fontWeight: 600 }}>오늘 21:00</span>
        </Card>
        <div style={{ marginTop: 'auto', width: '100%', paddingTop: 22 }}><Btn primary onClick={onDone}>대시보드로 ›</Btn></div>
      </Body>
    </Screen>
  )
}
