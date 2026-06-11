import { useState, type ReactNode } from 'react'
import { WF } from './design/tokens'
import { S_Login, S_TrackList, S_Dashboard, S_Edit } from './screens/home'
import { S_Concept, S_Quiz, S_Grade, S_Summary } from './screens/session'
import { S_Today, S_Stats, S_Settings } from './screens/tabs'

const API_URL = import.meta.env.VITE_API_URL ?? ''

type Screen =
  | 'home' | 'today' | 'stats' | 'settings'
  | 'dashboard' | 'edit'
  | 'concept' | 'quiz' | 'grade' | 'summary'

type Tab = 'home' | 'today' | 'stats' | 'settings'

// 모바일 화면(375×812)을 중앙에 띄우는 캔버스.
function Stage({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#f3f1ee', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, fontFamily: WF.sans }}>
      <div style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.10)', borderRadius: 18 }}>{children}</div>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')

  if (!authed) {
    return (
      <Stage>
        {/* TODO(auth): 실제로는 `${API_URL}/auth/google`로 리다이렉트. 지금은 데모 진입. */}
        <S_Login onGoogle={() => {
          if (API_URL) { /* window.location.href = `${API_URL}/auth/google` */ }
          setAuthed(true)
        }} />
      </Stage>
    )
  }

  const nav = (t: Tab) => setScreen(t)

  const view = () => {
    switch (screen) {
      case 'home': return <S_TrackList onOpen={() => setScreen('dashboard')} onNav={nav} />
      case 'today': return <S_Today onStart={() => setScreen('concept')} onNav={nav} />
      case 'stats': return <S_Stats onNav={nav} />
      case 'settings': return <S_Settings onLogout={() => setAuthed(false)} onNav={nav} />
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
