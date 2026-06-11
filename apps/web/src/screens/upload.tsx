// 트랙 추가 — .soul zip 업로드 → 완료 요약 → 시험일 설정.
// 흐름: 파일 선택 전 → zip 추가됨 → 업로드 중(로딩만) → 완료 → 시험일 설정 → 대시보드.
// upload 콜백 주입 시 실제 POST /tracks/import, 미주입 시 데모 시뮬레이션.
import { useState, useRef } from 'react'
import { WF, TONE } from '../design/tokens'
import { Screen, TopBar, Body, Card, Chip, Btn, Dday, Spinner, ZipGlyph, FileCard } from '../design/kit'
import type { ImportSummary } from '../api'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// 데모 요약(백엔드 없을 때).
const MOCK_SUMMARY: ImportSummary = { trackId: 'demo', trackSlug: '토익', title: '토익', decks: 3, cards: 128, concepts: 24, archived: 0 }

export function S_Upload({ onBack, onDone, upload }: {
  onBack?: () => void; onDone?: (r?: ImportSummary) => void; upload?: (f: File) => Promise<ImportSummary>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'select' | 'loading' | 'done'>('select')
  const [summary, setSummary] = useState<ImportSummary>(MOCK_SUMMARY)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = () => inputRef.current?.click()
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setError(null) }
  }
  const doUpload = async () => {
    if (!file) return
    setError(null)
    setPhase('loading')
    if (upload) {
      try {
        const result = await upload(file)
        setSummary(result)
        setPhase('done')
      } catch (e) {
        setError((e as Error).message)
        setPhase('select')
      }
    } else {
      setTimeout(() => { setSummary(MOCK_SUMMARY); setPhase('done') }, 1600) // 데모
    }
  }

  const hidden = (
    <input ref={inputRef} type="file" accept=".zip,application/zip" onChange={onFile} style={{ display: 'none' }} />
  )

  // ── 완료 ──────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <Screen>
        <TopBar title="트랙 추가" />
        <Body gap={0} style={{ paddingTop: 10 }}>
          <div style={{ textAlign: 'center', padding: '16px 0 6px', animation: 'wf-rise 0.4s ease' }}>
            <div style={{
              width: 60, height: 60, borderRadius: 30, margin: '0 auto 16px',
              background: TONE.ok.bg, border: `1px solid ${TONE.ok.c}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 28, color: TONE.ok.c, fontWeight: 700, lineHeight: 1 }}>✓</span>
            </div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>업로드 완료</div>
            <div style={{ fontSize: 13.5, color: WF.ink2, marginTop: 6, fontFamily: WF.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name}</div>
          </div>

          <Card style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{summary.title}</span>
              <Chip tone="off">시험일 설정 필요</Chip>
            </div>
            <div style={{ display: 'flex', gap: 22, marginTop: 14 }}>
              {([['덱', summary.decks], ['문항', summary.cards], ['개념', summary.concepts]] as [string, number][]).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: WF.mono, fontSize: 22, fontWeight: 700 }}>{v}</div>
                  <div style={{ fontSize: 12, color: WF.ink2, marginTop: 1 }}>{k}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* 다음 단계 안내 — 사용자 카피(메모성 주석 아님) */}
          <div style={{ marginTop: 24, fontSize: 13, color: WF.ink2, lineHeight: 1.55 }}>
            학습 계획을 만들려면 시험일이 필요해요. 다음 화면에서 설정합니다.
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <Btn primary onClick={() => onDone?.(summary)}>시험일 설정하기 ›</Btn>
          </div>
        </Body>
      </Screen>
    )
  }

  // ── 업로드 로딩(중간 단계 없이 로딩만) ──────────────────────────────────
  if (phase === 'loading') {
    return (
      <Screen>
        <TopBar title="트랙 추가" />
        <Body gap={0} style={{ paddingTop: 14 }}>
          {file && <FileCard name={file.name} size={formatBytes(file.size)} busy />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <Spinner size={36} stroke={3} dark />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>업로드 중…</div>
              <div style={{ fontSize: 13, color: WF.ink2, marginTop: 5 }}>잠시만 기다려 주세요</div>
            </div>
          </div>
        </Body>
      </Screen>
    )
  }

  // ── zip 추가됨 → 업로드 하기 ────────────────────────────────────────────
  if (file) {
    return (
      <Screen>
        {hidden}
        <TopBar title="트랙 추가" back onBack={onBack} />
        <Body gap={14} style={{ paddingTop: 16 }}>
          <div style={{ fontSize: 13, color: WF.ink2, fontWeight: 500 }}>추가할 파일</div>
          <FileCard name={file.name} size={formatBytes(file.size)} onRemove={() => setFile(null)} />
          {error && <div style={{ fontSize: 13, color: TONE.danger.c, lineHeight: 1.5 }}>{error}</div>}
          <div style={{ marginTop: 'auto' }}>
            <Btn primary onClick={doUpload}>업로드 하기</Btn>
          </div>
        </Body>
      </Screen>
    )
  }

  // ── 파일 선택 전(빈 상태) ───────────────────────────────────────────────
  return (
    <Screen>
      {hidden}
      <TopBar title="트랙 추가" back onBack={onBack} />
      <Body gap={16} style={{ paddingTop: 16 }}>
        <div onClick={pick} style={{
          border: `1.5px dashed ${WF.lineStrong}`, borderRadius: 16, background: WF.fill1,
          padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
        }}>
          <div style={{ display: 'inline-block', marginBottom: 14, opacity: 0.7 }}><ZipGlyph size={46} /></div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>ZIP 파일을 선택하세요</div>
          <div style={{ fontSize: 12.5, color: WF.ink2, marginTop: 5, fontFamily: WF.mono }}>탭하여 선택</div>
        </div>
        <div style={{ marginTop: 'auto' }}>
          <Btn primary onClick={pick}>파일 선택</Btn>
        </div>
      </Body>
    </Screen>
  )
}

// 시험일 설정 — 업로드 완료 후 강제 단계(examDate는 soul/zip에 없음).
const MONTH_DAYS = 30      // 2026년 6월
const FIRST_DOW = 1        // 2026-06-01 = 월요일
const DOW = ['일', '월', '화', '수', '목', '금', '토']

export function S_ExamDate({ trackTitle = '토익', onSave }: { trackTitle?: string; onSave?: (examDateISO: string) => void }) {
  const [selected, setSelected] = useState(11)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exam = new Date(2026, 5, selected)
  const today = new Date()
  const diff = Math.max(0, Math.ceil((exam.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000))
  const isoDate = `2026-06-${String(selected).padStart(2, '0')}` // 캘린더는 현재 2026년 6월 고정(추후 동적화)

  const save = async () => {
    if (!onSave) return
    setError(null); setSaving(true)
    try { await onSave(isoDate) } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  return (
    <Screen>
      <TopBar title="시험일 설정" />
      <Body gap={16} style={{ paddingTop: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{trackTitle} 시험일은 언제인가요?</div>
          <div style={{ fontSize: 13.5, color: WF.ink2, marginTop: 6, lineHeight: 1.5 }}>
            시험일을 기준으로 매일의 학습량이 자동으로 배분돼요.
          </div>
        </div>

        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ color: WF.ink3, fontSize: 18 }}>‹</span>
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>2026년 6월</span>
            <span style={{ color: WF.ink3, fontSize: 18 }}>›</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {DOW.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: WF.ink3, fontFamily: WF.mono }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {Array.from({ length: FIRST_DOW }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: MONTH_DAYS }, (_, i) => i + 1).map((d) => {
              const on = d === selected
              return (
                <div key={d} onClick={() => setSelected(d)} style={{
                  aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, borderRadius: 9, cursor: 'pointer',
                  background: on ? WF.inkSolid : 'transparent',
                  color: on ? '#fff' : WF.ink, fontWeight: on ? 700 : 500,
                }}>{d}</div>
              )
            })}
          </div>
        </Card>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
          <span style={{ fontSize: 13.5, color: WF.ink2 }}>선택: 2026년 6월 {selected}일</span>
          <Dday n={diff} urgent={diff <= 3} />
        </div>

        {error && <div style={{ fontSize: 13, color: TONE.danger.c, lineHeight: 1.5 }}>{error}</div>}
        <div style={{ marginTop: 'auto' }}>
          <Btn primary onClick={save}>{saving ? '저장 중…' : '저장하고 학습 시작 ›'}</Btn>
        </div>
      </Body>
    </Screen>
  )
}
