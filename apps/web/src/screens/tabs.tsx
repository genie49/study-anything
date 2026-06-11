// 오늘 · 통계 · 설정 + 건강 배너 매핑 — screens-tabs.jsx 이식.
import { WF, TONE, type Tone } from '../design/tokens'
import { Screen, TopBar, Body, Card, Chip, Bar, Dday, Btn, Marker, TabBar } from '../design/kit'
import { RetentionChart, HealthTrend } from '../design/charts'

type TabName = 'home' | 'today' | 'stats' | 'settings'

// 9. 오늘 (통합 큐)
export function S_Today({ onStart, onNav }: { onStart?: () => void; onNav?: (t: TabName) => void }) {
  return (
    <Screen>
      <TopBar title="오늘 할 일" big />
      <div style={{ padding: '0 22px 6px', fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>전체 70문항 · 38분</div>
      <Body gap={13}>
        <Card strong>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Marker tone="danger" /><span style={{ fontWeight: 700, fontSize: 16 }}>토익</span>
            </div>
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>42문항</span><Dday n={1} urgent />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}><Chip tone="danger" strong>과부하 · 우선</Chip></div>
          <Btn primary sm onClick={onStart}>토익 시작 ›</Btn>
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Marker tone="mid" /><span style={{ fontWeight: 700, fontSize: 16 }}>오픽</span>
            </div>
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>18문항</span><Dday n={12} />
            </div>
          </div>
          <Btn sm>오픽 시작 ›</Btn>
        </Card>
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Marker tone="ok" /><span style={{ fontWeight: 600, fontSize: 16, color: WF.ink2 }}>물리</span>
          </div>
          <span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>완료 ✓</span>
        </Card>
      </Body>
      <TabBar active="today" onNav={onNav} />
    </Screen>
  )
}

// 10. 통계
export function S_Stats({ onNav }: { onNav?: (t: TabName) => void }) {
  return (
    <Screen>
      <TopBar title="통계" big />
      <Body gap={16}>
        <div style={{ display: 'flex', gap: 7 }}>
          {['토익', '오픽', '물리'].map((t, i) => (
            <span key={t} style={{ fontFamily: WF.mono, fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1px solid ${i === 0 ? WF.ink : WF.line}`, background: i === 0 ? WF.fill1 : 'transparent', fontWeight: i === 0 ? 600 : 400 }}>{t}</span>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>보유율 곡선 <span style={{ color: WF.ink3, fontWeight: 400, fontFamily: WF.mono, fontSize: 11 }}>retention</span></div>
          <RetentionChart />
        </div>
        <Card>
          <div style={{ fontFamily: WF.mono, fontSize: 11, color: WF.ink2, marginBottom: 10 }}>R(examDate) vs target</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
            <span style={{ fontSize: 13, color: WF.ink2 }}>목표 90%</span>
            <span style={{ fontSize: 19, fontWeight: 700 }}>84%</span>
          </div>
          <Bar pct={84} dark />
        </Card>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>건강 추이 <span style={{ color: WF.ink3, fontWeight: 400, fontFamily: WF.mono, fontSize: 11 }}>health</span></div>
          <HealthTrend />
        </div>
      </Body>
      <TabBar active="stats" onNav={onNav} />
    </Screen>
  )
}

// 11. 설정 (로그아웃만)
export function S_Settings({ onLogout, onNav }: { onLogout?: () => void; onNav?: (t: TabName) => void }) {
  return (
    <Screen>
      <TopBar title="설정" big />
      <Body gap={18} style={{ paddingTop: 22 }}>
        <Card style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{ width: 42, height: 42, borderRadius: 21, background: WF.fill2, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: WF.mono, fontSize: 13, color: WF.ink2 }}>G</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>내 계정</div>
            <div style={{ fontSize: 12.5, color: WF.ink2, fontFamily: WF.mono, marginTop: 2 }}>you@gmail.com</div>
          </div>
        </Card>
        <div onClick={onLogout} style={{ border: `1px solid ${TONE.danger.c}`, borderRadius: 11, padding: '13px 18px', textAlign: 'center', fontSize: 15, fontWeight: 600, color: TONE.danger.c, background: WF.paper, cursor: 'pointer' }}>로그아웃</div>
        <div style={{ marginTop: 'auto', textAlign: 'center', fontFamily: WF.mono, fontSize: 11, color: WF.ink3 }}>study-anything · v0.1</div>
      </Body>
      <TabBar active="settings" onNav={onNav} />
    </Screen>
  )
}

// 건강 배너 매핑 (참조)
function HealthBanner({ tone, title, body }: { tone: Tone; title: string; body: string }) {
  const t = TONE[tone] || TONE.neutral
  return (
    <div style={{ border: `1px solid ${WF.line}`, borderLeft: `4px solid ${t.c}`, borderRadius: 12, padding: '15px 16px', background: t.bg, fontFamily: WF.sans, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Marker tone={tone} /><span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, color: WF.ink2, lineHeight: 1.5 }}>{body}</div>
    </div>
  )
}
export function S_HealthVariants() {
  const items: [Tone, string, string][] = [
    ['mid', '순항 · ON-TRACK', '오늘 분량을 진행하세요. 평소 용량 · 목표 0.90.'],
    ['danger', '과부하 · BEHIND', '미룬 분량이 쌓임. 신규 중단, 핵심부터 좁힘.'],
    ['warn', '숙달부족 · BEHIND', '정답률이 목표 미달. 복습·심화 문항을 늘립니다.'],
    ['ok', '여유 · AHEAD', '여유 있음. 신규를 앞당겨 미리 더 할 수 있어요.'],
    ['off', '시험일 미설정', '시험일을 설정해야 계획이 생성됩니다.'],
    ['crit', '실현 불가', '남은 기간으로 전 범위가 어려움. 우선순위 자동 정리(트리아지).'],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontFamily: WF.sans }}>
      {items.map((it, i) => <HealthBanner key={i} tone={it[0]} title={it[1]} body={it[2]} />)}
    </div>
  )
}
