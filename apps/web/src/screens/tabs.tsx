// 오늘 · 통계 · 설정 + 건강 배너 매핑 — screens-tabs.jsx 이식.
import { useState, useEffect } from 'react'
import { WF, TONE, type Tone } from '../design/tokens'
import { Screen, TopBar, Body, Card, Chip, Bar, Dday, Btn, Marker, TabBar } from '../design/kit'
import { RetentionChart, HealthTrend } from '../design/charts'
import { HEALTH_DISPLAY } from './home'
import { getStats, getSnapshots, type Track, type TrackStats, type Snapshot } from '../api'
import type { TodaySummary } from '../today'

type TabName = 'home' | 'today' | 'stats' | 'settings'

// 9. 오늘 (통합 큐). today 제공 시 실데이터(여러 트랙 합산), null=로딩, undefined=데모 목업.
export function S_Today({ today, onStart, onOpen, onNav }: {
  today?: TodaySummary | null
  onStart?: (track?: Track) => void
  onOpen?: (track: Track) => void
  onNav?: (t: TabName) => void
}) {
  if (today === undefined) return <DemoToday onStart={() => onStart?.()} onNav={onNav} />
  return <RealToday today={today} onStart={onStart} onOpen={onOpen} onNav={onNav} />
}

function RealToday({ today, onStart, onOpen, onNav }: {
  today: TodaySummary | null
  onStart?: (track?: Track) => void
  onOpen?: (track: Track) => void
  onNav?: (t: TabName) => void
}) {
  return (
    <Screen>
      <TopBar title="오늘 할 일" big />
      <div style={{ padding: '0 22px 6px', fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>
        {today === null ? '불러오는 중…'
          : today.totalCards > 0 ? `전체 ${today.totalCards}문항 · 약 ${today.totalMinutes}분`
          : '오늘 예정된 학습이 없어요'}
      </div>
      <Body gap={13}>
        {today === null ? null : today.rows.length === 0 ? (
          <div style={{ fontSize: 13.5, color: WF.ink3, textAlign: 'center', padding: '24px 0' }}>아직 트랙이 없어요.</div>
        ) : today.rows.map(({ track, plan }) => {
          const hd = HEALTH_DISPLAY[plan.health]
          const active = plan.todayTotal > 0
          const dleft = plan.daysLeft
          const header = (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: active ? 10 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Marker tone={hd.tone} /><span style={{ fontWeight: 700, fontSize: 16 }}>{track.title}</span>
              </div>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                {active && <span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>{plan.todayTotal}문항</span>}
                {plan.examSet && dleft !== null
                  ? <Dday n={Math.max(0, dleft)} urgent={dleft <= 3} />
                  : <Chip tone="off">시험일 미설정</Chip>}
              </div>
            </div>
          )
          // 할 일 있는 트랙: 시작 버튼이 주행동. 완료/미설정 트랙: 카드 탭 → 대시보드.
          if (active) {
            return (
              <Card key={track.id} strong>
                {header}
                <div style={{ marginBottom: 12 }}><Chip tone={hd.tone} strong={hd.tone === 'danger' || hd.tone === 'crit'}>{hd.title}</Chip></div>
                <Btn primary sm onClick={() => onStart?.(track)}>{track.title} 시작 ›</Btn>
              </Card>
            )
          }
          return (
            <div key={track.id} onClick={() => onOpen?.(track)} style={{ cursor: 'pointer' }}>
              <Card>
                {header}
                <div style={{ marginTop: 8, fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>
                  {plan.examSet ? '오늘 할 분량 없음 ✓' : '시험일을 설정하면 계획이 생성돼요'}
                </div>
              </Card>
            </div>
          )
        })}
      </Body>
      <TabBar active="today" onNav={onNav} />
    </Screen>
  )
}

// 데모 목업(백엔드 없음) — 원본 와이어프레임 비주얼 보존.
function DemoToday({ onStart, onNav }: { onStart?: () => void; onNav?: (t: TabName) => void }) {
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

// 10. 통계. tracks 제공 시 실데이터(정직 — 집계 가능한 수치만), undefined=데모 목업.
export function S_Stats({ tracks, onNav }: { tracks?: Track[]; onNav?: (t: TabName) => void }) {
  if (tracks === undefined) return <DemoStats onNav={onNav} />
  return <RealStats tracks={tracks} onNav={onNav} />
}

const GRADE_LABEL: { key: keyof TrackStats['byGrade']; label: string; tone: Tone }[] = [
  { key: 'again', label: '다시', tone: 'danger' },
  { key: 'hard', label: '어려움', tone: 'warn' },
  { key: 'good', label: '좋음', tone: 'mid' },
  { key: 'easy', label: '쉬움', tone: 'ok' },
]

function RealStats({ tracks, onNav }: { tracks: Track[]; onNav?: (t: TabName) => void }) {
  const [activeId, setActiveId] = useState<string | null>(tracks[0]?.id ?? null)
  const [stats, setStats] = useState<TrackStats | null>(null)
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null)

  useEffect(() => {
    if (!activeId) return
    setStats(null)
    setSnaps(null)
    void getStats(activeId).then(setStats).catch(() => setStats(null))
    void getSnapshots(activeId).then(setSnaps).catch(() => setSnaps(null))
  }, [activeId])

  const maxDay = stats ? Math.max(1, ...stats.last7.map((d) => d.count)) : 1
  const gradeTotal = stats ? GRADE_LABEL.reduce((a, g) => a + stats.byGrade[g.key], 0) : 0

  return (
    <Screen>
      <TopBar title="통계" big />
      <Body gap={16}>
        {tracks.length === 0 ? (
          <div style={{ fontSize: 13.5, color: WF.ink3, textAlign: 'center', padding: '24px 0' }}>아직 트랙이 없어요.</div>
        ) : (
          <>
            {/* 트랙 선택 */}
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {tracks.map((t) => {
                const on = t.id === activeId
                return (
                  <span key={t.id} onClick={() => setActiveId(t.id)} style={{
                    fontFamily: WF.mono, fontSize: 12, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    border: `1px solid ${on ? WF.ink : WF.line}`, background: on ? WF.fill1 : 'transparent', fontWeight: on ? 600 : 400,
                  }}>{t.title}</span>
                )
              })}
            </div>

            {!stats ? (
              <div style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink3, textAlign: 'center', padding: '8px 0' }}>불러오는 중…</div>
            ) : (
              <>
                {/* 진행률 */}
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
                    <span style={{ fontSize: 13, color: WF.ink2 }}>진행률 <span style={{ fontFamily: WF.mono, fontSize: 11, color: WF.ink3 }}>숙달 / 전체</span></span>
                    <span style={{ fontSize: 19, fontWeight: 700 }}>{stats.mastered}/{stats.total}</span>
                  </div>
                  <Bar pct={stats.progressPct} dark />
                </Card>

                {/* 누적 복습 · 정답률 */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <StatTile label="누적 복습" value={`${stats.totalReviews}`} unit="회" />
                  <StatTile label="정답률" value={stats.accuracy === null ? '—' : `${Math.round(stats.accuracy * 100)}`} unit={stats.accuracy === null ? '' : '%'} />
                </div>

                {/* 등급 분포 */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 9 }}>등급 분포 <span style={{ color: WF.ink3, fontWeight: 400, fontFamily: WF.mono, fontSize: 11 }}>grade</span></div>
                  {gradeTotal === 0 ? (
                    <div style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink3 }}>아직 채점 이력이 없어요.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {GRADE_LABEL.map((g) => {
                        const n = stats.byGrade[g.key]
                        return (
                          <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12.5, width: 44, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6 }}><Marker tone={g.tone} size={8} />{g.label}</span>
                            <Bar pct={Math.round((n / gradeTotal) * 100)} />
                            <span style={{ fontFamily: WF.mono, fontSize: 11, color: WF.ink2, width: 22, textAlign: 'right' }}>{n}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 최근 7일 활동 */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>최근 7일 활동 <span style={{ color: WF.ink3, fontWeight: 400, fontFamily: WF.mono, fontSize: 11 }}>복습 수</span></div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 76, padding: '0 2px' }}>
                    {stats.last7.map((d, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontFamily: WF.mono, fontSize: 9.5, color: d.count ? WF.ink2 : WF.ink3 }}>{d.count}</span>
                        <div style={{ width: '100%', height: Math.round((d.count / maxDay) * 46) + 2, background: d.count ? WF.inkSolid : WF.fill2, borderRadius: 3 }} />
                        <span style={{ fontFamily: WF.mono, fontSize: 8.5, color: WF.ink3 }}>{d.day.slice(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 보유율 곡선 — 학습한 카드의 R(시험일) 추이. 앱 연 날만, 보간 없음 */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>보유율 곡선 <span style={{ color: WF.ink3, fontWeight: 400, fontFamily: WF.mono, fontSize: 11 }}>R(시험일) 추이</span></div>
                  {snaps === null ? <ChartSkeleton /> : <RetentionCurveReal snaps={snaps} />}
                </div>

                {/* 건강 추이 — 일별 건강 상태(색). 앱 연 날만 */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>건강 추이 <span style={{ color: WF.ink3, fontWeight: 400, fontFamily: WF.mono, fontSize: 11 }}>health</span></div>
                  {snaps === null ? <ChartSkeleton /> : <HealthTrendReal snaps={snaps} />}
                </div>
              </>
            )}
          </>
        )}
      </Body>
      <TabBar active="stats" onNav={onNav} />
    </Screen>
  )
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Card style={{ flex: 1, textAlign: 'center', padding: '14px 10px' }}>
      <div style={{ fontFamily: WF.mono, fontSize: 11, color: WF.ink2, marginBottom: 8 }}>{label}</div>
      <div><span style={{ fontSize: 24, fontWeight: 700 }}>{value}</span><span style={{ fontSize: 13, color: WF.ink2, marginLeft: 3 }}>{unit}</span></div>
    </Card>
  )
}

function ChartSkeleton() {
  return <div style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink3, padding: '10px 0' }}>불러오는 중…</div>
}
function ChartEmpty({ label }: { label: string }) {
  return (
    <div style={{ border: `1px dashed ${WF.line}`, borderRadius: 10, padding: '18px 14px', textAlign: 'center', fontSize: 12.5, color: WF.ink3, lineHeight: 1.5 }}>{label}</div>
  )
}

// 보유율 곡선 — avgRExam 시계열. 점이 있는 날만(앱 연 날), 결측은 선으로 잇지 않음(정직).
function RetentionCurveReal({ snaps }: { snaps: Snapshot[] }) {
  const pts = snaps.filter((s): s is Snapshot & { avgRExam: number } => s.avgRExam !== null)
  if (pts.length < 2) return <ChartEmpty label="보유율 추이는 학습 기록이 2일 이상 쌓이면 표시돼요." />
  const W = 320, H = 116, padL = 8, padR = 8, top = 12, bot = 96
  const target = 0.9
  const yOf = (r: number) => bot - r * (bot - top)
  const xOf = (i: number) => padL + (i / (pts.length - 1)) * (W - padL - padR)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(p.avgRExam).toFixed(1)}`).join(' ')
  const targetY = yOf(target)
  return (
    <div style={{ border: `1px solid ${WF.lineSoft}`, borderRadius: 10, padding: '12px 12px 8px', background: WF.paper }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={116} preserveAspectRatio="none" style={{ display: 'block' }}>
        {[top, yOf(0.5), bot].map((y) => <line key={y} x1={padL} y1={y} x2={W - padR} y2={y} stroke={WF.lineSoft} strokeWidth="1" />)}
        <line x1={padL} y1={targetY} x2={W - padR} y2={targetY} stroke={TONE.ok.c} strokeWidth="1.5" strokeDasharray="4 4" />
        <path d={line} fill="none" stroke={WF.ink} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={xOf(i)} cy={yOf(p.avgRExam)} r="3" fill={WF.paper} stroke={WF.ink} strokeWidth="2" />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontFamily: WF.mono, fontSize: 9.5, color: WF.ink3 }}>{pts[0].day.slice(5)}</span>
        <span style={{ fontFamily: WF.mono, fontSize: 9.5, color: TONE.ok.c }}>목표 {Math.round(target * 100)}%</span>
        <span style={{ fontFamily: WF.mono, fontSize: 9.5, color: WF.ink3 }}>{pts[pts.length - 1].day.slice(5)}</span>
      </div>
    </div>
  )
}

// 건강 추이 — 최근 스냅샷 날들의 건강 상태(색 막대). 결측일은 비움.
function HealthTrendReal({ snaps }: { snaps: Snapshot[] }) {
  const recent = snaps.slice(-7)
  if (recent.length === 0) return <ChartEmpty label="건강 추이는 학습을 시작하면 쌓여요." />
  return (
    <div style={{ border: `1px solid ${WF.lineSoft}`, borderRadius: 10, padding: '12px 12px 8px', background: WF.paper }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
        {recent.map((s) => {
          const hd = HEALTH_DISPLAY[s.health]
          return (
            <div key={s.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div title={hd.title} style={{ width: '100%', height: 40, background: TONE[hd.tone].c, borderRadius: 3, opacity: 0.85 }} />
              <span style={{ fontFamily: WF.mono, fontSize: 8.5, color: WF.ink3 }}>{s.day.slice(5)}</span>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 8, fontFamily: WF.mono, fontSize: 10, color: WF.ink3 }}>최근 {recent.length}일 · {HEALTH_DISPLAY[recent[recent.length - 1].health].title}</div>
    </div>
  )
}

// 데모 목업(백엔드 없음) — 보유율 곡선·건강 추이는 시계열 미저장이라 데모에서만.
function DemoStats({ onNav }: { onNav?: (t: TabName) => void }) {
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
