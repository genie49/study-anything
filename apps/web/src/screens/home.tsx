// 홈 · 빈상태 · 트랙 대시보드 · 트랙 수정 · 로그인 — screens-home.jsx 이식.
import { useState } from 'react'
import { WF, TONE } from '../design/tokens'
import { Screen, TopBar, Body, Card, Chip, Bar, Dday, Divider, Btn, Field, Marker, InfoDot, HealthSheet, TabBar } from '../design/kit'
import { AppMark } from '../design/charts'

// 0. 로그인 (구글 단독)
export function S_Login({ onGoogle }: { onGoogle?: () => void }) {
  return (
    <Screen>
      <Body style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 0, padding: 34 }}>
        <div style={{ marginBottom: 26 }}><AppMark size={64} /></div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>study-anything</div>
        <div style={{ fontSize: 14, color: WF.ink2, marginTop: 10, lineHeight: 1.6, maxWidth: 240 }}>
          내용과 시험일만 넣으면<br />매일의 학습이 자동으로.
        </div>
        <div style={{ marginTop: 'auto', width: '100%' }}>
          <div onClick={onGoogle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
            border: `1px solid ${WF.line}`, borderRadius: 12, padding: '14px 18px',
            background: WF.paper, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: 4, border: `1px solid ${WF.line}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: WF.mono, fontSize: 13, fontWeight: 700, color: WF.ink2,
            }}>G</span>
            Google로 계속하기
          </div>
        </div>
      </Body>
    </Screen>
  )
}

// 1. 트랙 목록 (홈)
export function S_TrackList({ onOpen, onNav }: { onOpen?: () => void; onNav?: (t: 'home' | 'today' | 'stats' | 'settings') => void }) {
  return (
    <Screen>
      <TopBar title="내 학습" big />
      <Body gap={12}>
        <div onClick={onOpen} style={{ cursor: 'pointer' }}>
          <Card strong>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>토익</span><Dday n={1} urgent />
            </div>
            <div style={{ margin: '10px 0 12px' }}><Chip tone="danger" strong>과부하 · 오늘 42문항</Chip></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bar pct={60} dark /><span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>60%</span>
            </div>
          </Card>
        </div>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>오픽</span><Dday n={12} />
          </div>
          <div style={{ margin: '10px 0 12px' }}><Chip tone="mid">순항 · 오늘 18문항</Chip></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bar pct={30} /><span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>30%</span>
          </div>
        </Card>
        <div style={{ marginTop: 4 }}><Divider>시험일 미설정</Divider></div>
        <Card style={{ borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: WF.ink2 }}>물리</span>
            <Chip tone="off">시험일 설정 필요</Chip>
          </div>
          <div style={{ marginTop: 9, fontSize: 13, color: WF.ink3 }}>학습 계획 생성 대기</div>
        </Card>
      </Body>
      <TabBar active="home" onNav={onNav} />
    </Screen>
  )
}

// 12. 빈 상태
export function S_Empty({ onNav }: { onNav?: (t: 'home' | 'today' | 'stats' | 'settings') => void }) {
  return (
    <Screen>
      <TopBar title="내 학습" big />
      <Body pad={30} style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 0 }}>
        <div style={{ marginBottom: 22 }}><AppMark size={76} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>아직 트랙이 없어요</div>
        <div style={{ fontSize: 14, color: WF.ink2, lineHeight: 1.6, maxWidth: 250 }}>
          콘텐츠는 프론트가 아닌 <b>CLI</b>에서 가공합니다.
        </div>
        <Card style={{ marginTop: 26, textAlign: 'left', width: '100%', background: WF.fill1, borderStyle: 'dashed', padding: '20px 22px' }}>
          <div style={{ display: 'flex', gap: 13, marginBottom: 14 }}>
            <span style={{ fontFamily: WF.mono, fontWeight: 700, color: WF.ink2 }}>1</span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5 }}><b>soul-structuring</b> 스킬로<br /><span style={{ color: WF.ink2 }}>.soul 콘텐츠 생성</span></span>
          </div>
          <div style={{ display: 'flex', gap: 13 }}>
            <span style={{ fontFamily: WF.mono, fontWeight: 700, color: WF.ink2 }}>2</span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5 }}><b>import</b> 스크립트로<br /><span style={{ color: WF.ink2 }}>DB에 입력</span></span>
          </div>
        </Card>
      </Body>
      <TabBar active="home" onNav={onNav} />
    </Screen>
  )
}

// 2. 트랙 대시보드 (과부하)
export function S_Dashboard({ defaultInfo = false, onStart, onEdit, onBack }: { defaultInfo?: boolean; onStart?: () => void; onEdit?: () => void; onBack?: () => void }) {
  const [info, setInfo] = useState(defaultInfo)
  return (
    <Screen>
      <TopBar title="토익" back action={{ label: '수정' }} onBack={onBack} onAction={onEdit} />
      <Body gap={16}>
        <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
          <div style={{ fontFamily: WF.mono, fontSize: 30, fontWeight: 700, letterSpacing: '0.5px' }}>D-1</div>
          <div style={{ fontSize: 13, color: WF.ink2, marginTop: 2 }}>6월 11일 · 시험일</div>
        </div>
        <Card strong style={{ background: TONE.danger.bg, borderColor: TONE.danger.c }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Marker tone="danger" /><span style={{ fontWeight: 700, fontSize: 15 }}>과부하 상태</span>
            <span style={{ marginLeft: 'auto' }}><InfoDot onClick={() => setInfo(true)} /></span>
          </div>
          <div style={{ fontSize: 13.5, color: WF.ink2, lineHeight: 1.55, marginTop: 9 }}>
            미룬 분량이 쌓였어요. 핵심부터 좁혀서 <b>자동으로</b> 진행합니다.
          </div>
        </Card>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: WF.ink2, marginBottom: 9, fontFamily: WF.mono, letterSpacing: '0.3px' }}>오늘의 학습</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 10 }}>
            <span>개념 8 · 다지기 34</span>
            <span style={{ color: WF.ink2, fontFamily: WF.mono, fontSize: 12 }}>예상 25분</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bar pct={60} dark /><span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>25/42</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: WF.ink2, marginBottom: 11, fontFamily: WF.mono, letterSpacing: '0.3px' }}>덱 진척</div>
          {([['1주차 시제', 88], ['2주차 시제2', 41]] as [string, number][]).map(([t, p]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <span style={{ fontSize: 13, width: 92, flex: '0 0 auto' }}>{t}</span>
              <Bar pct={p} /><span style={{ fontFamily: WF.mono, fontSize: 11, color: WF.ink2, width: 30 }}>{p}%</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto' }}>
          <Btn primary onClick={onStart}>▶  오늘 학습 시작 (계속)</Btn>
        </div>
      </Body>
      {info && <HealthSheet onClose={() => setInfo(false)} />}
    </Screen>
  )
}

// 3. 트랙 수정 (이름·시험일만)
export function S_Edit({ onBack, onSave }: { onBack?: () => void; onSave?: () => void }) {
  return (
    <Screen>
      <TopBar title="토익 수정" back action={{ label: '저장', solid: true }} onBack={onBack} onAction={onSave} />
      <Body gap={22} style={{ paddingTop: 22 }}>
        <Field label="트랙 이름" value="토익" />
        <Field label="시험일 (deadline)" value="2026 – 06 – 11" icon="📅" />
        <Card style={{ background: WF.fill1, borderStyle: 'dashed', marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 9 }}>
            <span style={{ color: WF.ink3 }}>ⓘ</span>
            <span style={{ fontSize: 12.5, color: WF.ink2, lineHeight: 1.55 }}>
              <b>이름·시험일만</b> 수정 가능. 트랙 추가/삭제는 CLI(스킬 + 스크립트)에서만 합니다.
            </span>
          </div>
        </Card>
      </Body>
    </Screen>
  )
}
