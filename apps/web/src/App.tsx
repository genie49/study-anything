import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { WF } from './design/tokens'
import { hasBackend, login, tryRefresh, logout, devLogin, devLoginEnabled } from './auth'
import { getTracks, getPlan, getSession, importZip, patchTrack, deleteTrack, submitAnswer, gradeExplanation, suspendCard, type AnswerResult, type ImportSummary, type SessionItem, type SessionQueue, type Track } from './api'
import { summarizeToday, type TodayRow, type TodaySummary } from './today'
import { S_Login, S_TrackList, S_Empty, S_Dashboard, S_Edit } from './screens/home'
import { S_Upload, S_ExamDate } from './screens/upload'
import { S_Concept, S_Quiz, S_QuizMcq, S_Grade, S_Summary } from './screens/session'
import { S_Today, S_Stats, S_Settings } from './screens/tabs'

type Screen =
  | 'home' | 'today' | 'stats' | 'settings'
  | 'dashboard' | 'edit' | 'upload' | 'examdate'
  | 'concept' | 'quiz' | 'grade' | 'summary'

type Tab = 'home' | 'today' | 'stats' | 'settings'

// 모바일 풀블리드, 데스크톱은 중앙 정렬된 모바일 폭(≤480) 컬럼. 폰 목업 프레임 없음.
function Stage({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#e8e6e2', display: 'flex', justifyContent: 'center', fontFamily: WF.sans }}>
      <div style={{ width: '100%', maxWidth: 480, height: '100dvh', background: WF.paper, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }}>
        {children}
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WF.ink3, fontFamily: WF.mono, fontSize: 13 }}>
      불러오는 중…
    </div>
  )
}

// 진행 중 세션을 localStorage에 영속화해 새로고침·이탈 후에도 "이어서 학습"이 가능하게 한다.
// 카드 상태는 답안마다 서버에 저장되지만, 큐 순서·인덱스·재출제·세션 결과는 메모리에만 있어
// 이탈하면 초기화됐다. 이를 스냅샷으로 보존한다(데모 모드는 미저장).
const SESSION_KEY = 'sa:session:v1'
type SessionSnapshot = {
  trackId: string
  screen: Screen
  session: SessionQueue
  sessionIndex: number
  sessionResults: AnswerResult[]
  requeuedCardIds: string[]
  answerResult: AnswerResult | null
  passedConceptIds?: string[] // 이번 세션 중 자기설명을 통과한 개념(구버전 스냅샷엔 없음 → []로 취급)
}
function loadSnapshot(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SessionSnapshot
    if (!s?.trackId || !s.session?.items?.length) return null
    if (s.sessionIndex >= s.session.items.length) return null // 큐 범위 밖 → 폐기
    return s
  } catch { return null }
}
function saveSnapshot(s: SessionSnapshot) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* 용량/프라이빗 모드 무시 */ }
}
function clearSnapshot() {
  try { localStorage.removeItem(SESSION_KEY) } catch { /* 무시 */ }
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')

  // 백엔드 모드 실데이터. demo 모드(!hasBackend)에선 컴포넌트가 목업 렌더(props 미제공).
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const [selected, setSelected] = useState<Track | null>(null)                       // 대시보드/수정 대상
  const [examTrack, setExamTrack] = useState<{ id: string; title: string } | null>(null) // 업로드 후 시험일 설정 대상
  const [editingExam, setEditingExam] = useState(false) // 트랙 수정에서 시험일 재지정 진입(완료 후 대시보드 복귀)
  const [session, setSession] = useState<SessionQueue | null>(null)
  const [sessionIndex, setSessionIndex] = useState(0)
  const [sessionResults, setSessionResults] = useState<AnswerResult[]>([])
  const [requeuedCardIds, setRequeuedCardIds] = useState<Set<string>>(() => new Set())
  const [passedConceptIds, setPassedConceptIds] = useState<Set<string>>(() => new Set()) // 이번 세션 중 통과한 개념(게이트 즉시 해제용)
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null)
  const [submitPending, setSubmitPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [todayRows, setTodayRows] = useState<TodayRow[] | null>(null) // 오늘 탭: 트랙별 플랜 합산용
  // 이어서 학습 — 마지막으로 영속화된 진행 중 세션(새로고침에도 살아남음).
  const [resumable, setResumable] = useState<SessionSnapshot | null>(hasBackend ? loadSnapshot : null)
  const restoringRef = useRef(false) // 복원 직후 1프레임은 영속 효과를 건너뛰기 위한 가드

  const refreshTracks = useCallback(async () => {
    if (!hasBackend) return
    try { setTracks(await getTracks()) } catch { setTracks([]) }
  }, [])

  // API와 Web이 다른 호스트인 배포 환경에서는 Web이 API 쿠키를 읽을 수 없다.
  // 그래서 힌트 쿠키 확인 대신 refresh를 직접 시도한다.
  useEffect(() => {
    if (hasBackend) { void tryRefresh().then((ok) => { if (ok) setAuthed(true) }) }
  }, [])

  // 인증되면 트랙 목록 로드.
  useEffect(() => {
    if (authed && hasBackend) { void refreshTracks() }
  }, [authed, refreshTracks])

  // 오늘 탭 진입 시 트랙별 플랜을 병렬 fetch(소수 트랙이라 배치 엔드포인트 불필요).
  useEffect(() => {
    if (!hasBackend || screen !== 'today' || !tracks) return
    let cancelled = false
    setTodayRows(null)
    Promise.all(tracks.map(async (t) => ({ track: t, plan: await getPlan(t.id) })))
      .then((rows) => { if (!cancelled) setTodayRows(rows) })
      .catch(() => { if (!cancelled) setTodayRows([]) })
    return () => { cancelled = true }
  }, [screen, tracks])

  // 진행 중 세션 스냅샷 영속화 — 세션 화면에선 저장, 완료(summary) 시 정리.
  useEffect(() => {
    if (!hasBackend) return
    if (restoringRef.current) { restoringRef.current = false; return }
    const inSession = screen === 'concept' || screen === 'quiz' || screen === 'grade'
    if (inSession && session && selected && session.items.length) {
      const snap: SessionSnapshot = {
        trackId: selected.id, screen, session, sessionIndex,
        sessionResults, requeuedCardIds: [...requeuedCardIds], answerResult,
        passedConceptIds: [...passedConceptIds],
      }
      saveSnapshot(snap)
      setResumable(snap)
    } else if (screen === 'summary') {
      clearSnapshot()
      setResumable(null)
    }
  }, [screen, session, sessionIndex, sessionResults, answerResult, requeuedCardIds, passedConceptIds, selected])

  if (!authed) {
    return (
      <Stage>
        <S_Login
          onGoogle={() => {
            if (hasBackend) login()       // → 백엔드 구글 OAuth로 리다이렉트
            else setAuthed(true)          // 데모: 백엔드 없을 때 바로 진입
          }}
          onDevLogin={hasBackend && devLoginEnabled ? () => { void devLogin().then(setAuthed) } : undefined}
        />
      </Stage>
    )
  }

  const nav = (t: Tab) => setScreen(t)
  const doLogout = () => { clearSnapshot(); setResumable(null); void logout().then(() => { setAuthed(false); setTracks(null); setSelected(null) }) }
  const openTrack = (t?: Track) => { setSelected(t ?? null); setScreen('dashboard') }
  // 진행 중 세션 이어서 — 영속된 스냅샷에서 큐·인덱스·결과를 복원한다.
  const resumeSession = (snap?: SessionSnapshot) => {
    const s = snap ?? resumable
    if (!s) return
    const t = tracks?.find((x) => x.id === s.trackId) ?? selected
    if (t) setSelected(t)
    restoringRef.current = true // 복원이 트리거하는 영속 효과 1회 스킵(중복 저장 방지)
    setSession(s.session)
    setSessionIndex(s.sessionIndex)
    setSessionResults(s.sessionResults ?? [])
    setRequeuedCardIds(new Set(s.requeuedCardIds ?? []))
    setPassedConceptIds(new Set(s.passedConceptIds ?? []))
    setAnswerResult(s.answerResult ?? null)
    setSubmitError(null)
    setSubmitPending(false)
    setScreen(s.screen)
  }
  const startSession = async (track?: Track, extra = false) => {
    const t = track ?? selected // 오늘 탭에서 넘어온 트랙 우선(미지정이면 현재 선택).
    if (hasBackend && t) {
      setSelected(t) // 세션 후 대시보드 복귀가 올바른 트랙을 가리키도록.
      clearSnapshot(); setResumable(null) // 새 세션 시작 → 이전 진행 스냅샷 폐기.
      const q = await getSession(t.id, { extra })
      setSession(q)
      setSessionIndex(0)
      setSessionResults([])
      setRequeuedCardIds(new Set())
      setPassedConceptIds(new Set())
      setAnswerResult(null)
      setSubmitError(null)
      setSubmitPending(false)
      if (q.items.length === 0) { setScreen('dashboard'); return }
    }
    setScreen('concept')
  }
  const submitCurrentAnswer = async (answer: string) => {
    const item = session?.items[sessionIndex]
    if (!answer.trim()) return
    setSubmitError(null)
    setSubmitPending(true)
    if (hasBackend && selected && item) {
      try {
        const result = await submitAnswer(selected.id, {
          stateId: item.stateId,
          cardId: item.cardId,
          answer: answer.trim(),
        })
        setAnswerResult(result)
        setSessionResults((prev) => [...prev, result])
        if (result.grade === 'again' && !requeuedCardIds.has(item.cardId)) {
          setRequeuedCardIds((prev) => new Set(prev).add(item.cardId))
          setSession((prev) => {
            if (!prev) return prev
            const items = [...prev.items]
            const insertAt = Math.min(items.length, sessionIndex + 4)
            items.splice(insertAt, 0, item)
            return { ...prev, total: items.length, items }
          })
        }
        setScreen('grade')
      } catch (e) {
        setSubmitError((e as Error).message)
      } finally {
        setSubmitPending(false)
      }
      return
    }
    setSubmitPending(false)
    setScreen('grade')
  }
  // 다시 안 보기 — 오류 문제를 영구 제외하고 현재 세션 큐에서도 즉시 제거한 뒤 다음 문항으로.
  const suspendCurrentCard = async () => {
    const item = session?.items[sessionIndex]
    if (!session || !item) return
    if (hasBackend && selected) {
      try { await suspendCard(selected.id, item.stateId) }
      catch (e) { setSubmitError((e as Error).message); return }
    }
    // 같은 카드의 모든 인스턴스(재출제분 포함) 제거.
    const items = session.items.filter((it) => it.cardId !== item.cardId)
    setSession({ ...session, total: items.length, items })
    setAnswerResult(null)
    setSubmitError(null)
    if (sessionIndex >= items.length) { setScreen('summary'); return }
    setScreen('concept')
  }
  const nextSessionStep = () => {
    const total = session?.items.length ?? 0
    const next = sessionIndex + 1
    if (hasBackend && session && next < total) {
      setSessionIndex(next)
      setAnswerResult(null)
      setSubmitError(null)
      setScreen('concept')
      return
    }
    setScreen('summary')
  }
  const againReviewItems = (): SessionItem[] => {
    if (!session) return []
    const itemsByCardId = new Map(session.items.map((item) => [item.cardId, item]))
    const latestByCardId = new Map<string, AnswerResult>()
    for (const result of sessionResults) latestByCardId.set(result.cardId, result)
    return [...latestByCardId.values()]
      .filter((result) => result.grade === 'again')
      .map((result) => itemsByCardId.get(result.cardId))
      .filter((item): item is SessionItem => Boolean(item))
  }

  const startAgainReview = () => {
    if (!session) return
    const reviewItems = againReviewItems()
    if (reviewItems.length === 0) return
    setSession({ trackId: session.trackId, total: reviewItems.length, items: reviewItems })
    setSessionIndex(0)
    setSessionResults([])
    setRequeuedCardIds(new Set())
    setAnswerResult(null)
    setSubmitError(null)
    setSubmitPending(false)
    setScreen('concept')
  }

  // 홈: 백엔드 모드는 실데이터(빈 목록→S_Empty, 로딩→스피너), 데모 모드는 목업.
  const homeView = () => {
    if (!hasBackend) return <S_TrackList onOpen={openTrack} onAdd={() => setScreen('upload')} onNav={nav} />
    if (tracks === null) return <Loading />
    if (tracks.length === 0) return <S_Empty onAdd={() => setScreen('upload')} onNav={nav} />
    return <S_TrackList tracks={tracks} onOpen={openTrack} onAdd={() => setScreen('upload')} onNav={nav} />
  }

  // 업로드 완료 → 시험일 설정으로. 백엔드면 summary로 대상 트랙 지정.
  const onUploaded = (r?: ImportSummary) => {
    if (hasBackend && r) setExamTrack({ id: r.trackId, title: r.title })
    setScreen('examdate')
  }

  // 시험일 저장 → 백엔드면 PATCH 후 갱신. 수정 진입이면 대시보드(갱신된 트랙), 업로드면 홈.
  const onExamSave = async (iso: string) => {
    if (hasBackend && examTrack) {
      const updated = await patchTrack(examTrack.id, { examDate: iso })
      await refreshTracks()
      setExamTrack(null)
      if (editingExam) { setEditingExam(false); setSelected(updated); setScreen('dashboard') }
      else { setScreen('home') }
    } else {
      setScreen('dashboard')
    }
  }

  // 트랙 수정에서 시험일 재지정 진입.
  const onEditExam = () => {
    if (!selected) return
    setExamTrack({ id: selected.id, title: selected.title })
    setEditingExam(true)
    setScreen('examdate')
  }
  const onExamCancel = () => { setEditingExam(false); setExamTrack(null); setScreen('edit') }

  // 트랙 삭제 → 백엔드면 DELETE 후 갱신하고 홈.
  const onDeleteTrack = async () => {
    if (hasBackend && selected) {
      if (resumable?.trackId === selected.id) { clearSnapshot(); setResumable(null) }
      await deleteTrack(selected.id)
      await refreshTracks()
      setSelected(null)
    }
    setScreen('home')
  }

  const view = () => {
    const currentItem = session?.items[sessionIndex]
    const totalItems = session?.items.length ?? 42
    const done = hasBackend ? sessionResults.length : 0
    const hasAgainReview = againReviewItems().length > 0
    // 오늘 탭: 백엔드면 트랙별 플랜 합산(로딩 중 null), 데모면 undefined→목업.
    const todaySummary: TodaySummary | null | undefined = hasBackend
      ? (todayRows ? summarizeToday(todayRows) : null)
      : undefined
    switch (screen) {
      case 'home': return homeView()
      case 'today': return <S_Today today={todaySummary} onStart={(t) => { void startSession(t) }} onOpen={openTrack} onNav={nav} />
      case 'stats': return <S_Stats tracks={hasBackend ? (tracks ?? []) : undefined} onNav={nav} />
      case 'settings': return <S_Settings onLogout={doLogout} onNav={nav} />
      case 'dashboard': return <S_Dashboard track={hasBackend ? selected ?? undefined : undefined} resumable={!!resumable && !!selected && resumable.trackId === selected.id} onResume={() => resumeSession()} onStart={(extra) => { void startSession(undefined, extra) }} onEdit={() => setScreen('edit')} onBack={() => setScreen('home')} />
      case 'edit': return <S_Edit track={hasBackend ? selected ?? undefined : undefined} onBack={() => setScreen('dashboard')} onSave={() => setScreen('dashboard')} onDelete={onDeleteTrack} onEditExam={hasBackend ? onEditExam : undefined} />
      // 트랙 추가: zip 업로드 → 완료 → 시험일 설정 → (백엔드)홈 / (데모)대시보드
      case 'upload': return <S_Upload upload={hasBackend ? importZip : undefined} onBack={() => setScreen('home')} onDone={onUploaded} />
      case 'examdate': return <S_ExamDate trackTitle={examTrack?.title ?? '토익'} initialISO={editingExam ? selected?.examDate ?? null : null} onSave={onExamSave} onCancel={editingExam ? onExamCancel : undefined} />
      // 세션 플로우(목업, 스케줄러 연결 전): 개념 → 다지기 → 채점 → 완료
      case 'concept': return <S_Concept item={currentItem} done={done} total={totalItems} passed={!!currentItem && (currentItem.conceptPassed || passedConceptIds.has(currentItem.conceptId))} onClose={() => setScreen('dashboard')} onNext={() => setScreen('quiz')} onExplain={hasBackend && selected && currentItem ? async (ex) => {
        const fb = await gradeExplanation(selected.id, currentItem.conceptId, ex)
        // 통과 시 같은 개념의 다른 카드도 이번 세션에선 게이트 없이 진행 가능하도록 기록.
        if (fb.sufficient && currentItem.conceptId) setPassedConceptIds((prev) => new Set(prev).add(currentItem.conceptId))
        return fb
      } : undefined} />
      case 'quiz': {
        const quizKey = `${currentItem?.stateId ?? 'demo'}:${sessionIndex}`
        const quizProps = { key: quizKey, item: currentItem, done, total: totalItems, submitting: submitPending, error: submitError, onClose: () => setScreen('dashboard'), onSubmit: (answer: string) => { void submitCurrentAnswer(answer) }, onSuspend: hasBackend && selected && currentItem ? () => { void suspendCurrentCard() } : undefined }
        // mcq는 보기 선택형, 그 외(cloze·qa·application)는 서술 입력형.
        return currentItem?.type === 'mcq' && currentItem.distractors.length > 0
          ? <S_QuizMcq {...quizProps} />
          : <S_Quiz {...quizProps} />
      }
      case 'grade': return <S_Grade answerResult={answerResult ?? undefined} done={done} total={totalItems} result="partial" onClose={() => setScreen('dashboard')} onNext={nextSessionStep} onSuspend={hasBackend && selected && currentItem ? () => { void suspendCurrentCard() } : undefined} />
      case 'summary': return <S_Summary results={sessionResults} completed={sessionResults.length || undefined} correct={sessionResults.filter((r) => r.correct).length || undefined} onReviewAgain={hasAgainReview ? startAgainReview : undefined} onDone={() => setScreen('dashboard')} />
      default: return homeView()
    }
  }

  return <Stage>{view()}</Stage>
}
