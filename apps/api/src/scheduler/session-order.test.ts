// 세션 인터리빙 — 불변식(순열 보존·인접 분리·우선순위 보존). 매직 순서 아님.
import { describe, it, expect } from 'vitest'
import { interleaveSession, type Interleavable } from './session-order'

type Item = Interleavable & { id: string }
const mk = (id: string, conceptId: string, type = 'qa'): Item => ({ id, conceptId, type })

// 멀티셋 동일성(순열인지) 검사.
function sameMultiset(a: Item[], b: Item[]): boolean {
  const key = (xs: Item[]) => xs.map((x) => x.id).sort().join(',')
  return a.length === b.length && key(a) === key(b)
}

describe('interleaveSession', () => {
  it('빈/단일 입력은 그대로', () => {
    expect(interleaveSession<Item>([])).toEqual([])
    expect(interleaveSession([mk('x', 'A')])).toEqual([mk('x', 'A')])
  })

  it('항상 순열(누락·중복 없음)', () => {
    const input = [mk('1', 'A'), mk('2', 'A'), mk('3', 'B'), mk('4', 'B'), mk('5', 'C')]
    const out = interleaveSession(input)
    expect(sameMultiset(out, input)).toBe(true)
  })

  it('분리 가능하면 같은 개념을 연속 배치하지 않음', () => {
    // 개념 [A,A,B,B] → A B A B 처럼 인접 분리 가능.
    const out = interleaveSession([mk('1', 'A'), mk('2', 'A'), mk('3', 'B'), mk('4', 'B')])
    for (let i = 1; i < out.length; i++) expect(out[i].conceptId).not.toBe(out[i - 1].conceptId)
  })

  it('분리 가능하면 같은 유형을 연속 배치하지 않음', () => {
    // 같은 개념·다른 유형 [qa,qa,mcq,mcq] → 유형 인접 분리.
    const out = interleaveSession([mk('1', 'A', 'qa'), mk('2', 'A', 'qa'), mk('3', 'A', 'mcq'), mk('4', 'A', 'mcq')])
    for (let i = 1; i < out.length; i++) expect(out[i].type).not.toBe(out[i - 1].type)
  })

  it('첫 카드는 항상 최상위 우선(입력 0번) — 우선순위 보존', () => {
    const input = [mk('top', 'A'), mk('2', 'A'), mk('3', 'B')]
    expect(interleaveSession(input)[0].id).toBe('top')
  })

  it('모두 다른 개념·유형이면 입력 순서 유지(재배치 불필요)', () => {
    const input = [mk('1', 'A'), mk('2', 'B'), mk('3', 'C')]
    expect(interleaveSession(input).map((x) => x.id)).toEqual(['1', '2', '3'])
  })

  it('전부 같은 개념·유형이면 분리 불가하나 전원 보존(무한루프·누락 없음)', () => {
    const input = [mk('1', 'A'), mk('2', 'A'), mk('3', 'A')]
    const out = interleaveSession(input)
    expect(out).toHaveLength(3)
    expect(sameMultiset(out, input)).toBe(true)
  })
})
