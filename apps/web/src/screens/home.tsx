// 홈 · 빈상태 · 트랙 대시보드 · 트랙 수정 · 로그인 — screens-home.jsx 이식.
import { useState, useEffect } from 'react'
import { WF, TONE, type Tone } from '../design/tokens'
import { Screen, TopBar, Body, Card, Chip, Bar, Dday, Divider, Btn, Field, Marker, InfoDot, HealthSheet, TabBar } from '../design/kit'
import { AppMark } from '../design/charts'
import { getPlan, type Track, type TrackPlan, type HealthState } from '../api'

// 건강상태 → 배너 표시(톤·문구).
export const HEALTH_DISPLAY: Record<HealthState, { tone: Tone; title: string; body: string }> = {
  no_exam:         { tone: 'off',    title: '시험일 미설정', body: '시험일을 설정하면 학습 계획이 생성됩니다. ‘수정’에서 지정하세요.' },
  on_track:        { tone: 'mid',    title: '순항',         body: '오늘 분량을 진행하세요.' },
  behind_overload: { tone: 'danger', title: '과부하',       body: '밀린 분량이 쌓였어요. 핵심부터 좁혀 자동으로 진행합니다.' },
  behind_mastery:  { tone: 'warn',   title: '숙달 부족',     body: '정답률이 목표에 못 미쳐요. 복습·심화를 늘립니다.' },
  ahead:           { tone: 'ok',     title: '여유',         body: '오늘 분량을 마쳤어요. 신규를 앞당겨 더 할 수 있어요.' },
  infeasible:      { tone: 'crit',   title: '실현 어려움',   body: '남은 기간으로 전 범위가 빠듯해요. 우선순위를 자동 정리합니다.' },
}

type Tab = 'home' | 'today' | 'stats' | 'settings'

// examDate는 백엔드가 new Date('YYYY-MM-DD')로 UTC 자정에 저장 → 의도한 캘린더 날짜는 UTC 기준.
// 로컬 자정과 직접 빼면 타임존만큼 어긋난다(예: KST +9h → 하루 over-count). UTC 날짜를 로컬 자정으로 환산.
function examLocalMidnight(examDate: string): Date {
  const e = new Date(examDate)
  return new Date(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())
}
// examDate → 오늘 자정 기준 남은 일수(정수일). 미래만 양수.
function ddays(examDate: string): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((examLocalMidnight(examDate).getTime() - today.getTime()) / 86_400_000)
}
function examLabel(examDate: string): string {
  const d = examLocalMidnight(examDate)
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`
}

// 구글 공식 4색 "G" 로고 (브랜딩 가이드라인)
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" style={{ display: 'block', flex: '0 0 auto' }} aria-hidden>
      <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  )
}

// 0. 로그인 (구글 단독). onDevLogin 제공 시 dev 전용 테스트 로그인 버튼 노출.
export function S_Login({ onGoogle, onDevLogin }: { onGoogle?: () => void; onDevLogin?: () => void }) {
  return (
    <Screen>
      <Body style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 0, padding: 34 }}>
        <div style={{ marginBottom: 26 }}><AppMark size={64} /></div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>study-anything</div>
        <div style={{ fontSize: 14, color: WF.ink2, marginTop: 10, lineHeight: 1.6, maxWidth: 240 }}>
          내용과 시험일만 넣으면<br />매일의 학습이 자동으로.
        </div>
        <div style={{ marginTop: 'auto', width: '100%' }}>
          {/* 구글 공식 Sign-in 버튼 — 흰 배경 · #747775 테두리 · 4색 G · #1f1f1f 텍스트 */}
          <button onClick={onGoogle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            width: '100%', height: 48, border: '1px solid #747775', borderRadius: 12,
            background: '#fff', color: '#1f1f1f', fontFamily: WF.sans,
            fontSize: 15, fontWeight: 600, letterSpacing: '0.1px', cursor: 'pointer',
          }}>
            <GoogleG />
            Google 계정으로 계속하기
          </button>
          {onDevLogin && (
            <button onClick={onDevLogin} style={{
              marginTop: 10, width: '100%', height: 38, border: `1px dashed ${WF.line}`, borderRadius: 10,
              background: 'transparent', color: WF.ink3, fontFamily: WF.mono, fontSize: 12, cursor: 'pointer',
            }}>dev 로그인 (테스트 계정)</button>
          )}
        </div>
      </Body>
    </Screen>
  )
}

// 1. 트랙 목록 (홈). tracks 제공 시 실데이터(sparse — 건강·진도는 스케줄러 연결 후),
// 미제공 시 데모 목업.
export function S_TrackList({ tracks, onOpen, onAdd, onNav }: {
  tracks?: Track[]; onOpen?: (t?: Track) => void; onAdd?: () => void; onNav?: (t: Tab) => void
}) {
  return (
    <Screen>
      <TopBar title="내 학습" big action={{ label: '＋ 추가', solid: true }} onAction={onAdd} />
      <Body gap={12}>
        {tracks ? <RealTrackCards tracks={tracks} onOpen={onOpen} /> : <DemoTrackCards onOpen={() => onOpen?.()} />}
      </Body>
      <TabBar active="home" onNav={onNav} />
    </Screen>
  )
}

// 실데이터 카드 — 이름 + 시험일(D-day)/미설정. 가짜 건강·진도는 그리지 않는다.
function RealTrackCards({ tracks, onOpen }: { tracks: Track[]; onOpen?: (t: Track) => void }) {
  return (
    <>
      {tracks.map((t) => {
        const hasExam = !!t.examDate
        const n = hasExam ? ddays(t.examDate as string) : null
        return (
          <div key={t.id} onClick={() => onOpen?.(t)} style={{ cursor: 'pointer' }}>
            <Card strong={hasExam} style={hasExam ? undefined : { borderStyle: 'dashed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: hasExam ? WF.ink : WF.ink2 }}>{t.title}</span>
                {hasExam ? <Dday n={Math.max(0, n as number)} urgent={(n as number) <= 3} /> : <Chip tone="off">시험일 설정 필요</Chip>}
              </div>
              <div style={{ marginTop: 9, fontSize: 13, color: WF.ink3 }}>
                {hasExam ? `시험일 ${examLabel(t.examDate as string)} · 학습 계획 준비 중` : '학습 계획 생성 대기'}
              </div>
            </Card>
          </div>
        )
      })}
    </>
  )
}

// 데모 목업(백엔드 없음) — 원본 와이어프레임 비주얼 보존.
function DemoTrackCards({ onOpen }: { onOpen?: () => void }) {
  return (
    <>
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
    </>
  )
}

// 12. 빈 상태
export function S_Empty({ onAdd, onNav }: { onAdd?: () => void; onNav?: (t: 'home' | 'today' | 'stats' | 'settings') => void }) {
  return (
    <Screen>
      <TopBar title="내 학습" big />
      <Body pad={30} style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 0 }}>
        <div style={{ marginBottom: 22 }}><AppMark size={76} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>아직 트랙이 없어요</div>
        <div style={{ fontSize: 14, color: WF.ink2, lineHeight: 1.6, maxWidth: 250 }}>
          콘텐츠 <b>ZIP</b>을 올리면 자동으로<br />덱과 문항이 만들어져요.
        </div>
        <div style={{ marginTop: 26, width: '100%' }}>
          <Btn primary onClick={onAdd}>＋ ZIP 업로드로 트랙 추가</Btn>
        </div>
      </Body>
      <TabBar active="home" onNav={onNav} />
    </Screen>
  )
}

// 2. 트랙 대시보드. track 제공 시 실데이터(정직 — 가짜 건강/진도 없이 스케줄러 대기
// 안내), 미제공 시 데모 목업.
export function S_Dashboard({ track, defaultInfo = false, onStart, onEdit, onBack }: {
  track?: Track; defaultInfo?: boolean; onStart?: () => void; onEdit?: () => void; onBack?: () => void
}) {
  if (track) return <RealDashboard track={track} onStart={onStart} onEdit={onEdit} onBack={onBack} />
  return <DemoDashboard defaultInfo={defaultInfo} onStart={onStart} onEdit={onEdit} onBack={onBack} />
}

function RealDashboard({ track, onStart, onEdit, onBack }: { track: Track; onStart?: () => void; onEdit?: () => void; onBack?: () => void }) {
  const [plan, setPlan] = useState<TrackPlan | null>(null)
  const [info, setInfo] = useState(false)
  // 세션 완료 후 대시보드 복귀 시 화면 전환으로 이 컴포넌트가 remount → getPlan 재호출 → 갱신된 숫자 반영.
  useEffect(() => { setPlan(null); void getPlan(track.id).then(setPlan).catch(() => setPlan(null)) }, [track.id])

  const hasExam = !!track.examDate
  const n = hasExam ? Math.max(0, ddays(track.examDate as string)) : null
  const hd = plan ? HEALTH_DISPLAY[plan.health] : null
  const tone = hd?.tone ?? 'neutral'

  return (
    <Screen>
      <TopBar title={track.title} back action={{ label: '수정' }} onBack={onBack} onAction={onEdit} />
      <Body gap={16}>
        <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
          {hasExam ? (
            <>
              <div style={{ fontFamily: WF.mono, fontSize: 30, fontWeight: 700, letterSpacing: '0.5px' }}>D-{n}</div>
              <div style={{ fontSize: 13, color: WF.ink2, marginTop: 2 }}>{examLabel(track.examDate as string)} · 시험일</div>
            </>
          ) : (
            <div style={{ marginTop: 6 }}><Chip tone="off">시험일 설정 필요</Chip></div>
          )}
        </div>

        {!plan ? (
          <div style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink3, textAlign: 'center', padding: '8px 0' }}>플랜 계산 중…</div>
        ) : (
          <>
            {/* 건강 배너 — 상태색 + ? 설명 시트 */}
            <Card strong style={{ background: TONE[tone].bg, borderColor: TONE[tone].c }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Marker tone={tone} /><span style={{ fontWeight: 700, fontSize: 15 }}>{hd?.title}</span>
                <span style={{ marginLeft: 'auto' }}><InfoDot onClick={() => setInfo(true)} /></span>
              </div>
              <div style={{ fontSize: 13.5, color: WF.ink2, lineHeight: 1.55, marginTop: 9 }}>{hd?.body}</div>
            </Card>

            {/* 오늘의 학습 — 실제 플랜 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: WF.ink2, marginBottom: 9, fontFamily: WF.mono, letterSpacing: '0.3px' }}>오늘의 학습</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 10 }}>
                <span>개념 {plan.todayNew} · 다지기 {plan.todayReview}</span>
                <span style={{ color: WF.ink2, fontFamily: WF.mono, fontSize: 12 }}>예상 {plan.estMinutes}분</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bar pct={plan.progressPct} dark /><span style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink2 }}>{plan.mastered}/{plan.total}</span>
              </div>
            </div>

            <div style={{ marginTop: 'auto' }}>
              {plan.todayTotal > 0
                ? <Btn primary onClick={onStart}>▶  오늘 학습 시작 ({plan.todayTotal}문항)</Btn>
                : <div style={{ fontFamily: WF.mono, fontSize: 12, color: WF.ink3, textAlign: 'center' }}>오늘 할 분량이 없어요 ✓</div>}
            </div>
          </>
        )}
      </Body>
      {info && <HealthSheet onClose={() => setInfo(false)} />}
    </Screen>
  )
}

function DemoDashboard({ defaultInfo = false, onStart, onEdit, onBack }: { defaultInfo?: boolean; onStart?: () => void; onEdit?: () => void; onBack?: () => void }) {
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

// 3. 트랙 수정 (이름·시험일 + 삭제). track 제공 시 실제 값, 미제공 시 데모.
export function S_Edit({ track, onBack, onSave, onDelete, onEditExam }: {
  track?: Track; onBack?: () => void; onSave?: () => void; onDelete?: () => void; onEditExam?: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const title = track?.title ?? '토익'
  const examValue = track
    ? (track.examDate ? examLabel(track.examDate) : '미설정')
    : '2026 – 06 – 11'
  const canEditExam = !!track && !!onEditExam
  return (
    <Screen>
      <TopBar title={`${title} 수정`} back action={{ label: '저장', solid: true }} onBack={onBack} onAction={onSave} />
      <Body gap={22} style={{ paddingTop: 22 }}>
        <Field label="트랙 이름" value={title} />
        {/* 시험일 — 탭하면 캘린더에서 재지정 */}
        <div onClick={canEditExam ? onEditExam : undefined} style={{ cursor: canEditExam ? 'pointer' : 'default' }}>
          <Field label="시험일 (deadline)" value={examValue} icon="📅" />
        </div>
        {canEditExam && (
          <div style={{ fontSize: 12, color: WF.ink3, lineHeight: 1.5, marginTop: -14 }}>
            시험일을 탭하면 캘린더에서 변경할 수 있어요.
          </div>
        )}

        {/* 위험 구역 — 삭제 */}
        <div style={{ marginTop: 'auto' }}>
          <Divider>위험 구역</Divider>
          <div onClick={() => setConfirm(true)} style={{
            marginTop: 14, cursor: 'pointer',
            border: `1px solid ${TONE.danger.c}`, borderRadius: 11, padding: '13px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 15, fontWeight: 600, color: TONE.danger.c, background: WF.paper,
          }}>
            <Marker tone="danger" /> 트랙 삭제
          </div>
        </div>
      </Body>
      {confirm && (
        <DeleteSheet
          name={title}
          detail={track ? '덱·개념·카드·모든 학습 이력' : '덱 3 · 문항 128 · 통계 전체'}
          onClose={() => setConfirm(false)}
          onConfirm={onDelete}
        />
      )}
    </Screen>
  )
}

// 트랙 삭제 확인 시트
function DeleteSheet({ name, detail, onClose, onConfirm }: { name: string; detail: string; onClose?: () => void; onConfirm?: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,28,24,0.32)', display: 'flex', alignItems: 'flex-end', zIndex: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: WF.paper, width: '100%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '16px 22px calc(env(safe-area-inset-bottom) + 26px)', boxShadow: '0 -8px 30px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 38, height: 4, background: WF.fill3, borderRadius: 4, margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <Marker tone="danger" size={11} />
          <span style={{ fontSize: 17, fontWeight: 700 }}>‘{name}’ 트랙을 삭제할까요?</span>
        </div>
        <div style={{ fontSize: 13.5, color: WF.ink2, lineHeight: 1.55, marginBottom: 18 }}>
          덱·문항과 <b>모든 학습 이력·진척</b>이 영구 삭제됩니다. 되돌릴 수 없어요.
        </div>
        <div style={{ background: WF.fill1, border: `1px solid ${WF.lineSoft}`, borderRadius: 10, padding: '11px 13px', marginBottom: 18, fontFamily: WF.mono, fontSize: 11.5, color: WF.ink2 }}>
          삭제 대상: {detail}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><Btn ghost onClick={onClose}>취소</Btn></div>
          <div onClick={onConfirm} style={{ flex: 1, background: TONE.danger.c, color: '#fff', fontFamily: WF.sans, fontSize: 15, fontWeight: 600, padding: '13px 18px', borderRadius: 10, textAlign: 'center', cursor: 'pointer' }}>삭제</div>
        </div>
      </div>
    </div>
  )
}
