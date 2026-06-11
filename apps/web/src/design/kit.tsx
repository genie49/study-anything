// 와이어프레임 공유 프리미티브 — wireframe-kit.jsx 이식(TS화).
import type { CSSProperties, ReactNode } from 'react'
import { WF, TONE, type Tone } from './tokens'

type Style = CSSProperties

// 실제 모바일 뷰포트를 채우는 유동형 화면. 폰 목업 프레임/가짜 상태바 없음.
// 높이 체인: Stage(100dvh) → Screen(height:100%, flex-col) → Body(flex:1, 스크롤).
// 실기기의 노치/상태바는 safe-area-inset-top으로 회피(데스크톱은 0이라 상수 10px 더함).
export function Screen({ children, bg = WF.paper, style }: {
  children?: ReactNode; bg?: string; style?: Style
}) {
  return (
    <div style={{
      width: '100%', height: '100%', background: bg, position: 'relative',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: WF.sans, color: WF.ink,
      paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
      ...style,
    }}>
      {children}
    </div>
  )
}

type TabName = 'home' | 'today' | 'stats' | 'settings'
function TabIcon({ name, active }: { name: TabName; active: boolean }) {
  const c = active ? WF.ink : WF.ink3
  const common = { fill: 'none', stroke: c, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'home') return <svg width="22" height="22" viewBox="0 0 22 22"><path d="M3.5 9.5 11 3.5l7.5 6M5.5 8.5v9h11v-9" {...common} /></svg>
  if (name === 'today') return <svg width="22" height="22" viewBox="0 0 22 22"><g {...common}><rect x="3.5" y="4.5" width="15" height="14" rx="2.5" /><path d="M3.5 8.5h15M7 2.8v3.4M15 2.8v3.4" /><circle cx="11" cy="13" r="0.5" fill={c} stroke="none" /></g></svg>
  if (name === 'stats') return <svg width="22" height="22" viewBox="0 0 22 22"><g {...common}><path d="M3.5 18.5h15" /><rect x="5" y="11" width="3" height="5.5" /><rect x="9.5" y="7" width="3" height="9.5" /><rect x="14" y="4" width="3" height="12.5" /></g></svg>
  return <svg width="22" height="22" viewBox="0 0 22 22"><g {...common}><path d="M4 7h9M16 7h2M4 15h2M9 15h9" /><circle cx="14.5" cy="7" r="2" fill={WF.paper} /><circle cx="7.5" cy="15" r="2" fill={WF.paper} /></g></svg>
}

export function TabBar({ active = 'home', onNav }: { active?: TabName; onNav?: (t: TabName) => void }) {
  const tabs: [TabName, string][] = [['home', '홈'], ['today', '오늘'], ['stats', '통계'], ['settings', '설정']]
  return (
    <div style={{
      flex: '0 0 auto', borderTop: `1px solid ${WF.lineSoft}`, background: WF.paper,
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
      padding: '8px 0 calc(env(safe-area-inset-bottom) + 14px)',
    }}>
      {tabs.map(([n, label]) => (
        <div key={n} onClick={() => onNav?.(n)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: onNav ? 'pointer' : 'default' }}>
          <TabIcon name={n} active={active === n} />
          <span style={{ fontSize: 10.5, fontWeight: active === n ? 600 : 500, color: active === n ? WF.ink : WF.ink3 }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

export function TopBar({ title, back = false, action, big = false, onBack, onAction }: {
  title: string; back?: boolean; action?: { label: string; solid?: boolean }; big?: boolean; onBack?: () => void; onAction?: () => void
}) {
  return (
    <div style={{
      flex: '0 0 auto', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: big ? '8px 22px 2px' : '4px 18px', minHeight: 44,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {back && <span onClick={onBack} style={{ fontSize: 22, color: WF.ink2, lineHeight: 1, marginTop: -2, cursor: 'pointer' }}>‹</span>}
        <span style={{ fontSize: big ? 26 : 17, fontWeight: big ? 700 : 600, letterSpacing: big ? '-0.5px' : 0 }}>{title}</span>
      </div>
      {action && <span onClick={onAction} style={{ fontSize: 15, fontWeight: 600, color: action.solid ? WF.ink : WF.ink2, cursor: 'pointer' }}>{action.label}</span>}
    </div>
  )
}

export function Bar({ pct, h = 7, dark = false, w = '100%' }: { pct: number; h?: number; dark?: boolean; w?: number | string }) {
  return (
    <div style={{ width: w, height: h, background: WF.fill2, borderRadius: h, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: dark ? WF.inkSolid : WF.lineStrong, borderRadius: h }} />
    </div>
  )
}

export function Marker({ tone = 'neutral', size = 9 }: { tone?: Tone; size?: number }) {
  const t = TONE[tone] || TONE.neutral
  if (tone === 'ok') return <span style={{ fontSize: size + 2, color: t.c, fontWeight: 700, lineHeight: 1 }}>✓</span>
  if (tone === 'off') return <span style={{ width: size, height: size, border: `1.5px dashed ${t.c}`, borderRadius: size, display: 'inline-block', boxSizing: 'border-box' }} />
  if (tone === 'neutral') return <span style={{ width: size, height: size, background: WF.ink3, borderRadius: size, display: 'inline-block' }} />
  if (tone === 'danger' || tone === 'crit') return <span style={{ width: size, height: size, background: t.c, borderRadius: 2, display: 'inline-block' }} />
  return <span style={{ width: size, height: size, background: t.c, borderRadius: size, display: 'inline-block' }} />
}

export function Chip({ tone = 'neutral', children, strong = false }: { tone?: Tone; children?: ReactNode; strong?: boolean }) {
  const t = TONE[tone] || TONE.neutral
  const colored = tone !== 'neutral'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: WF.mono,
      fontSize: 11, letterSpacing: '0.2px', padding: '3px 9px', borderRadius: 20,
      border: `1px solid ${colored ? t.c : WF.line}`,
      background: strong ? t.bg : 'transparent',
      color: WF.ink, fontWeight: strong ? 600 : 500, whiteSpace: 'nowrap',
    }}>
      <Marker tone={tone} />{children}
    </span>
  )
}

export function Dday({ n, urgent = false }: { n: number; urgent?: boolean }) {
  return (
    <span style={{
      fontFamily: WF.mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.3px',
      padding: '3px 8px', borderRadius: 6,
      background: urgent ? TONE.danger.c : WF.fill2, color: urgent ? '#fff' : WF.ink,
    }}>D-{n}</span>
  )
}

export function InfoDot({ onClick }: { onClick?: () => void }) {
  return (
    <span onClick={onClick} style={{
      width: 19, height: 19, borderRadius: 10, border: `1px solid ${WF.line}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, color: WF.ink2, cursor: 'pointer', fontFamily: WF.mono, flex: '0 0 auto', lineHeight: 1,
    }}>?</span>
  )
}

export function HealthSheet({ onClose }: { onClose?: () => void }) {
  const rows: [Tone, string, string][] = [
    ['mid', '순항', '오늘 분량을 그대로 진행. 평소 용량 · 목표 보유율 0.90.'],
    ['danger', '과부하', '밀린 분량 > 용량. 신규를 멈추고 핵심부터 좁혀 자동 분산.'],
    ['warn', '숙달 부족', '자꾸 틀려 목표 미달. 복습·심화 문항을 늘림.'],
    ['ok', '여유', '오늘 끝. 신규를 앞당겨 미리 더 학습 가능.'],
    ['off', '시험일 미설정', '시험일을 넣어야 학습 계획이 생성됨.'],
    ['crit', '실현 불가', '남은 기간으로 전 범위가 어려움. 우선순위를 자동 정리.'],
  ]
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,28,24,0.32)', display: 'flex', alignItems: 'flex-end', zIndex: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: WF.paper, width: '100%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '16px 22px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 38, height: 4, background: WF.fill3, borderRadius: 4, margin: '0 auto 18px' }} />
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>건강 상태란?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {rows.map(([t, name, desc]) => (
            <div key={name} style={{ display: 'flex', gap: 12 }}>
              <span style={{ marginTop: 3, flex: '0 0 auto' }}><Marker tone={t} size={10} /></span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 12.5, color: WF.ink2, lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Divider({ children }: { children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <span style={{ flex: 1, height: 1, background: WF.lineSoft }} />
      <span style={{ fontFamily: WF.mono, fontSize: 10.5, color: WF.ink3, letterSpacing: '0.5px' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: WF.lineSoft }} />
    </div>
  )
}

export function Btn({ children, primary = false, ghost = false, full = true, sm = false, onClick }: {
  children?: ReactNode; primary?: boolean; ghost?: boolean; full?: boolean; sm?: boolean; onClick?: () => void
}) {
  const base: Style = {
    fontFamily: WF.sans, fontSize: sm ? 13 : 15, fontWeight: 600,
    padding: sm ? '8px 14px' : '13px 18px', borderRadius: 10, textAlign: 'center',
    width: full ? '100%' : 'auto', boxSizing: 'border-box', whiteSpace: 'nowrap', cursor: 'pointer',
  }
  if (primary) return <div onClick={onClick} style={{ ...base, background: WF.inkSolid, color: '#fff' }}>{children}</div>
  if (ghost) return <div onClick={onClick} style={{ ...base, background: 'transparent', color: WF.ink, border: `1px solid ${WF.line}` }}>{children}</div>
  return <div onClick={onClick} style={{ ...base, background: WF.fill1, color: WF.ink, border: `1px solid ${WF.lineSoft}` }}>{children}</div>
}

export function Field({ value, icon, label }: { value?: string; icon?: ReactNode; label?: string }) {
  return (
    <div>
      {label && <div style={{ fontSize: 13, color: WF.ink2, marginBottom: 7, fontWeight: 500 }}>{label}</div>}
      <div style={{
        border: `1px solid ${WF.line}`, borderRadius: 10, padding: '13px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 15, color: value ? WF.ink : WF.ink3, background: WF.paper,
      }}>
        <span>{value || '입력'}</span>
        {icon && <span style={{ color: WF.ink3 }}>{icon}</span>}
      </div>
    </div>
  )
}

export function Note({ children, n }: { children?: ReactNode; n?: number | string }) {
  return (
    <div style={{ display: 'flex', gap: 7, fontFamily: WF.mono, fontSize: 10.5, color: WF.ink3, lineHeight: 1.5, letterSpacing: '0.2px' }}>
      {n != null && <span style={{
        flex: '0 0 auto', width: 15, height: 15, borderRadius: 9, border: `1px solid ${WF.ink3}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, marginTop: 1,
      }}>{n}</span>}
      <span>{children}</span>
    </div>
  )
}

export function Card({ children, style, strong = false }: { children?: ReactNode; style?: Style; strong?: boolean }) {
  return (
    <div style={{
      border: `1px solid ${strong ? WF.lineStrong : WF.line}`, borderRadius: 14,
      padding: 16, background: WF.paper, ...style,
    }}>{children}</div>
  )
}

export function Body({ children, pad = 18, gap = 14, style }: { children?: ReactNode; pad?: number; gap?: number; style?: Style }) {
  // flex:1 + minHeight:0 + overflowY:auto → 내용이 뷰포트보다 길면 스크롤(잘림 방지).
  return (
    <div style={{ flex: 1, minHeight: 0, padding: pad, display: 'flex', flexDirection: 'column', gap, overflowY: 'auto', ...style }}>
      {children}
    </div>
  )
}
