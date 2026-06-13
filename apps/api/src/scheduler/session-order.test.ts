// 세션 인터리빙 — 불변식(순열 보존·인접 분리·우선순위 보존). 매직 순서 아님.
import { describe, it, expect } from 'vitest'
import { interleaveSession, reserveBatch, drillNewRatio, batchSplit, type Interleavable } from './session-order.js'

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

describe('drillNewRatio (다지기 정도 → 신규 비율, 0~90% 선형)', () => {
  it('숙달비율 1 → 최대 90%', () => {
    expect(drillNewRatio(40, 40)).toBeCloseTo(0.9)
  })
  it('숙달비율 0 → 0% (복습에 집중)', () => {
    expect(drillNewRatio(0, 40)).toBe(0)
  })
  it('선형: 숙달비율 0.5 → 45%', () => {
    expect(drillNewRatio(20, 40)).toBeCloseTo(0.45)
  })
  it('아직 푼 게 없으면(studied=0) 제약 없음 → 최대', () => {
    expect(drillNewRatio(0, 0)).toBeCloseTo(0.9)
  })
  it('실데이터(38/40) ≈ 85.5%', () => {
    expect(drillNewRatio(38, 40)).toBeCloseTo(0.855)
  })
})

describe('batchSplit (카운트 분할 — plan 표시와 세션 선택 공유)', () => {
  it('복습·신규 충분: 비율대로 분할', () => {
    expect(batchSplit(40, 477, 40, 0.855)).toEqual({ review: 6, fresh: 34 })
  })
  it('복습 0: 전부 신규', () => {
    expect(batchSplit(0, 500, 40, 0.9)).toEqual({ review: 0, fresh: 40 })
  })
  it('합이 용량 미만: 있는 것만', () => {
    expect(batchSplit(3, 2, 40, 0.5)).toEqual({ review: 3, fresh: 2 })
  })
})

describe('reserveBatch (추가 학습 — 신규 비율 동적)', () => {
  const R = (n: number) => Array.from({ length: n }, (_, i) => `r${i}`)
  const N = (n: number) => Array.from({ length: n }, (_, i) => `n${i}`)

  it('비율 0.5 — 신규 절반', () => {
    const out = reserveBatch(R(40), N(477), 40, 0.5)
    expect(out).toHaveLength(40)
    expect(out.filter((x) => x.startsWith('n'))).toHaveLength(20)
  })

  it('비율 0.855 — 신규 ~34개(round)', () => {
    const out = reserveBatch(R(40), N(477), 40, 0.855)
    expect(out.filter((x) => x.startsWith('n'))).toHaveLength(34)
    expect(out.filter((x) => x.startsWith('r'))).toHaveLength(6)
  })

  it('비율 0 — 복습만(신규 0)', () => {
    const out = reserveBatch(R(40), N(477), 40, 0)
    expect(out.filter((x) => x.startsWith('n'))).toHaveLength(0)
    expect(out.filter((x) => x.startsWith('r'))).toHaveLength(40)
  })

  it('복습이 적으면 신규가 빈 슬롯을 더 채운다(슬롯 낭비 없음)', () => {
    const out = reserveBatch(R(2), N(477), 40, 0.5)
    expect(out).toHaveLength(40)
    expect(out.filter((x) => x.startsWith('r'))).toHaveLength(2)
    expect(out.filter((x) => x.startsWith('n'))).toHaveLength(38)
  })

  it('신규가 적으면 복습이 빈 슬롯을 채운다', () => {
    const out = reserveBatch(R(40), N(5), 40, 0.9)
    expect(out).toHaveLength(40)
    expect(out.filter((x) => x.startsWith('n'))).toHaveLength(5)
    expect(out.filter((x) => x.startsWith('r'))).toHaveLength(35)
  })

  it('복습이 앞, 신규가 뒤 — 우선순위 보존', () => {
    const out = reserveBatch(R(10), N(10), 10, 0.5)
    expect(out[0]).toBe('r0')
    expect(out[out.length - 1]).toBe('n4')
  })

  it('합이 용량 미만이면 있는 것만', () => {
    expect(reserveBatch(R(3), N(2), 40, 0.5)).toHaveLength(5)
  })
})
