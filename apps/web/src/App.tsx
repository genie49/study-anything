import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { WF } from './design/tokens'
import { hasBackend, hasSessionHint, login, tryRefresh, logout, devLogin, devLoginEnabled } from './auth'
import { getTracks, importZip, patchTrack, deleteTrack, type ImportSummary, type Track } from './api'
import { S_Login, S_TrackList, S_Empty, S_Dashboard, S_Edit } from './screens/home'
import { S_Upload, S_ExamDate } from './screens/upload'
import { S_Concept, S_Quiz, S_Grade, S_Summary } from './screens/session'
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

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')

  // 백엔드 모드 실데이터. demo 모드(!hasBackend)에선 컴포넌트가 목업 렌더(props 미제공).
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const [selected, setSelected] = useState<Track | null>(null)                       // 대시보드/수정 대상
  const [examTrack, setExamTrack] = useState<{ id: string; title: string } | null>(null) // 업로드 후 시험일 설정 대상

  const refreshTracks = useCallback(async () => {
    if (!hasBackend) return
    try { setTracks(await getTracks()) } catch { setTracks([]) }
  }, [])

  // 로그인 흔적이 있을 때만 침묵 로그인 시도 — 최초 방문자에겐 401 안 띄움.
  useEffect(() => {
    if (hasBackend && hasSessionHint()) { void tryRefresh().then(setAuthed) }
  }, [])

  // 인증되면 트랙 목록 로드.
  useEffect(() => {
    if (authed && hasBackend) { void refreshTracks() }
  }, [authed, refreshTracks])

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
  const doLogout = () => { void logout().then(() => { setAuthed(false); setTracks(null); setSelected(null) }) }
  const openTrack = (t?: Track) => { setSelected(t ?? null); setScreen('dashboard') }

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

  // 시험일 저장 → 백엔드면 PATCH 후 목록 갱신하고 홈, 데모면 대시보드.
  const onExamSave = async (iso: string) => {
    if (hasBackend && examTrack) {
      await patchTrack(examTrack.id, { examDate: iso })
      await refreshTracks()
      setExamTrack(null)
      setScreen('home')
    } else {
      setScreen('dashboard')
    }
  }

  // 트랙 삭제 → 백엔드면 DELETE 후 갱신하고 홈.
  const onDeleteTrack = async () => {
    if (hasBackend && selected) {
      await deleteTrack(selected.id)
      await refreshTracks()
      setSelected(null)
    }
    setScreen('home')
  }

  const view = () => {
    switch (screen) {
      case 'home': return homeView()
      case 'today': return <S_Today onStart={() => setScreen('concept')} onNav={nav} />
      case 'stats': return <S_Stats onNav={nav} />
      case 'settings': return <S_Settings onLogout={doLogout} onNav={nav} />
      case 'dashboard': return <S_Dashboard track={hasBackend ? selected ?? undefined : undefined} onStart={() => setScreen('concept')} onEdit={() => setScreen('edit')} onBack={() => setScreen('home')} />
      case 'edit': return <S_Edit track={hasBackend ? selected ?? undefined : undefined} onBack={() => setScreen('dashboard')} onSave={() => setScreen('dashboard')} onDelete={onDeleteTrack} />
      // 트랙 추가: zip 업로드 → 완료 → 시험일 설정 → (백엔드)홈 / (데모)대시보드
      case 'upload': return <S_Upload upload={hasBackend ? importZip : undefined} onBack={() => setScreen('home')} onDone={onUploaded} />
      case 'examdate': return <S_ExamDate trackTitle={examTrack?.title ?? '토익'} onSave={onExamSave} />
      // 세션 플로우(목업, 스케줄러 연결 전): 개념 → 다지기 → 채점 → 완료
      case 'concept': return <S_Concept stage="ok" onClose={() => setScreen('dashboard')} onNext={() => setScreen('quiz')} />
      case 'quiz': return <S_Quiz onClose={() => setScreen('dashboard')} onSubmit={() => setScreen('grade')} />
      case 'grade': return <S_Grade result="partial" onClose={() => setScreen('dashboard')} onNext={() => setScreen('summary')} />
      case 'summary': return <S_Summary onDone={() => setScreen('dashboard')} />
      default: return homeView()
    }
  }

  return <Stage>{view()}</Stage>
}
