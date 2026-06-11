// SVG 데이터 시각화 + 앱 마크 — charts.jsx 이식.
import { WF, TONE, type Tone } from './tokens'

export function RetentionChart({ h = 116 }: { h?: number }) {
  const W = 320, H = 116, padL = 8, padR = 8, base = 96
  const pts: [number, number][] = [
    [8, 12], [58, 46], [58, 14], [120, 44], [120, 12],
    [196, 38], [196, 10], [300, 30], [312, 24],
  ]
  const reviews: [number, number][] = [[58, 14], [120, 12], [196, 10]]
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ')
  const area = line + ` L312 ${base} L8 ${base} Z`
  const targetY = 26
  return (
    <div style={{ border: `1px solid ${WF.lineSoft}`, borderRadius: 10, padding: '12px 12px 8px', background: WF.paper }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: 'block' }}>
        {[12, 26, 54, base].map((y) => (
          <line key={y} x1={padL} y1={y} x2={W - padR} y2={y} stroke={WF.lineSoft} strokeWidth="1" />
        ))}
        <line x1={padL} y1={targetY} x2={W - padR} y2={targetY} stroke={TONE.ok.c} strokeWidth="1.5" strokeDasharray="4 4" />
        <path d={area} fill={WF.fill1} opacity="0.7" />
        <path d={line} fill="none" stroke={WF.ink} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {reviews.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={WF.paper} stroke={WF.ink} strokeWidth="2" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontFamily: WF.mono, fontSize: 9.5, color: WF.ink3 }}>4주 전</span>
        <span style={{ fontFamily: WF.mono, fontSize: 9.5, color: TONE.ok.c }}>목표 90%</span>
        <span style={{ fontFamily: WF.mono, fontSize: 9.5, color: WF.ink3 }}>지금</span>
      </div>
    </div>
  )
}

export function HealthTrend({ h = 78 }: { h?: number }) {
  const days = ['월', '화', '수', '목', '금', '토', '일']
  const data: [number, Tone][] = [
    [62, 'mid'], [70, 'mid'], [48, 'warn'], [80, 'mid'],
    [34, 'danger'], [88, 'mid'], [100, 'ok'],
  ]
  return (
    <div style={{ border: `1px solid ${WF.lineSoft}`, borderRadius: 10, padding: '12px 14px 8px', background: WF.paper }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: h }}>
        {data.map(([v, tone], i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ width: '100%', height: `${v}%`, background: TONE[tone].c, opacity: 0.9, borderRadius: '3px 3px 0 0' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {days.map((d) => (
          <span key={d} style={{ flex: 1, textAlign: 'center', fontFamily: WF.mono, fontSize: 9.5, color: WF.ink3 }}>{d}</span>
        ))}
      </div>
    </div>
  )
}

export function AppMark({ size = 64 }: { size?: number }) {
  const r = size * 0.26
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
      <rect x="0" y="0" width="64" height="64" rx={r} fill={WF.inkSolid} />
      <rect x="15" y="36" width="7" height="13" rx="2" fill="#fff" opacity="0.55" />
      <rect x="28.5" y="28" width="7" height="21" rx="2" fill="#fff" opacity="0.8" />
      <rect x="42" y="20" width="7" height="29" rx="2" fill="#fff" />
      <circle cx="45.5" cy="14" r="3.4" fill={TONE.ok.c} />
    </svg>
  )
}
