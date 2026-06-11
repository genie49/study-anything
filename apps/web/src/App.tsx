import { useState, useEffect, type ReactNode } from 'react'
import { WF } from './design/tokens'
import { hasBackend, login, tryRefresh, logout } from './auth'
import { S_Login, S_TrackList, S_Dashboard, S_Edit } from './screens/home'
import { S_Concept, S_Quiz, S_Grade, S_Summary } from './screens/session'
import { S_Today, S_Stats, S_Settings } from './screens/tabs'

type Screen =
  | 'home' | 'today' | 'stats' | 'settings'
  | 'dashboard' | 'edit'
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

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')

  // 백엔드가 있으면 앱 로드 시 refresh 쿠키로 침묵 로그인 시도.
  useEffect(() => {
    if (hasBackend) { void tryRefresh().then(setAuthed) }
  }, [])

  if (!authed) {
    return (
      <Stage>
        <S_Login onGoogle={() => {
          if (hasBackend) login()       // → 백엔드 구글 OAuth로 리다이렉트
          else setAuthed(true)          // 데모: 백엔드 없을 때 바로 진입
        }} />
      </Stage>
    )
  }

  const nav = (t: Tab) => setScreen(t)
  const doLogout = () => { void logout().then(() => setAuthed(false)) }

  const view = () => {
    switch (screen) {
      case 'home': return <S_TrackList onOpen={() => setScreen('dashboard')} onNav={nav} />
      case 'today': return <S_Today onStart={() => setScreen('concept')} onNav={nav} />
      case 'stats': return <S_Stats onNav={nav} />
      case 'settings': return <S_Settings onLogout={doLogout} onNav={nav} />
      case 'dashboard': return <S_Dashboard onStart={() => setScreen('concept')} onEdit={() => setScreen('edit')} onBack={() => setScreen('home')} />
      case 'edit': return <S_Edit onBack={() => setScreen('dashboard')} onSave={() => setScreen('dashboard')} />
      // 세션 플로우: 개념(게이트 통과) → 다지기 → 채점 → 완료
      case 'concept': return <S_Concept stage="ok" onClose={() => setScreen('dashboard')} onNext={() => setScreen('quiz')} />
      case 'quiz': return <S_Quiz onClose={() => setScreen('dashboard')} onSubmit={() => setScreen('grade')} />
      case 'grade': return <S_Grade result="partial" onClose={() => setScreen('dashboard')} onNext={() => setScreen('summary')} />
      case 'summary': return <S_Summary onDone={() => setScreen('dashboard')} />
      default: return <S_TrackList onOpen={() => setScreen('dashboard')} onNav={nav} />
    }
  }

  return <Stage>{view()}</Stage>
}
