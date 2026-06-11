// 세션 진행 순서의 인터리빙 — 같은 개념/유형 연속 금지(§7.4 "섞어야 변별된다").
// 입력은 이미 우선순위순(위험도 높은=먼저, 복습이 신규보다 앞)으로 정렬돼 있다고 가정하고,
// 그 우선순위를 최대한 보존하면서 "인접 중복"만 흩는다. 위험도 재점수화·시험중요도
// 가중은 v1에서 dueAt 정렬(=연체순=위험도 근사)에 위임 → 여기선 순서 변형만 담당.
//
// Again 카드의 세션 내 재삽입(3~5장 뒤)은 런타임(App.tsx)에서 처리 — 여기 중복 안 함.

export type Interleavable = { conceptId: string; type: string }

// 우선순위순 입력을 받아, 직전 카드와 개념·유형이 겹치지 않는 최상위 우선 카드를
// 매 단계 선택. 완전 회피 불가 시 단계적으로 완화(개념 분리 > 유형 분리 > 불가피).
// 매 반복마다 정확히 하나 제거 → 종료 보장, 항상 순열(누락·중복 없음).
export function interleaveSession<T extends Interleavable>(items: T[]): T[] {
  if (items.length <= 1) return [...items]
  const remaining = [...items]
  const out: T[] = []
  let lastConcept: string | null = null
  let lastType: string | null = null
  while (remaining.length) {
    let idx = remaining.findIndex((c) => c.conceptId !== lastConcept && c.type !== lastType)
    if (idx === -1) idx = remaining.findIndex((c) => c.conceptId !== lastConcept) // 개념 분리 우선
    if (idx === -1) idx = remaining.findIndex((c) => c.type !== lastType)
    if (idx === -1) idx = 0 // 남은 게 전부 같은 개념·유형 — 분리 불가
    const [picked] = remaining.splice(idx, 1)
    out.push(picked)
    lastConcept = picked.conceptId
    lastType = picked.type
  }
  return out
}
