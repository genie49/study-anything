// 디자인 토큰 — claude.ai/design 핸드오프(wireframe-kit.jsx)에서 그대로 이식.
// Greyscale, paper-like. 픽셀 드리프트 방지를 위해 값 보존.

export const WF = {
  paper: '#ffffff',
  line: '#cbc8c2',
  lineSoft: '#e4e1db',
  lineStrong: '#9a968e',
  ink: '#2a2925',
  ink2: '#6f6c65',
  ink3: '#a8a49c',
  fill1: '#efedea',
  fill2: '#e2dfd9',
  fill3: '#d3cfc8',
  inkSolid: '#26241f', // primary button / strong CTA
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
  sans: 'Pretendard, -apple-system, system-ui, sans-serif',
} as const

// 알고리즘 건강상태 색(차분한 저채도 oklch). 그 외는 paper/grey 유지.
export type Tone = 'neutral' | 'off' | 'mid' | 'danger' | 'crit' | 'warn' | 'ok' | 'cool'

export const TONE: Record<Tone, { c: string; bg: string }> = {
  neutral: { c: '#a8a49c', bg: '#f1efec' },                 // 플레인 카테고리
  off:     { c: '#a8a49c', bg: '#f1efec' },                 // 미설정
  mid:     { c: 'oklch(0.74 0.085 84)',  bg: 'oklch(0.965 0.03 88)'  }, // 순항 🟡
  danger:  { c: 'oklch(0.585 0.13 33)',  bg: 'oklch(0.955 0.035 40)' }, // 과부하 🔴
  crit:    { c: 'oklch(0.505 0.15 30)',  bg: 'oklch(0.95 0.04 35)'   }, // 실현불가 🔴強
  warn:    { c: 'oklch(0.665 0.115 58)', bg: 'oklch(0.96 0.035 70)'  }, // 숙달부족 🟠
  ok:      { c: 'oklch(0.60 0.09 150)',  bg: 'oklch(0.955 0.03 155)' }, // 여유/완료 🟢
  cool:    { c: 'oklch(0.62 0.075 245)', bg: 'oklch(0.96 0.025 245)' }, // 쉬움 🔵
}
