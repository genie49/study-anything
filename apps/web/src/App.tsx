const API_URL = import.meta.env.VITE_API_URL ?? ''

export default function App() {
  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <main className="mx-auto max-w-md px-4 py-6">
        <h1 className="text-xl font-bold">내 학습</h1>
        <p className="mt-2 text-sm text-neutral-500">
          인프라 스캐폴드 — 화면은 <code>docs/frontend-screens.md</code> 기준으로 구현 예정.
        </p>
        <p className="mt-1 text-xs text-neutral-400">API: {API_URL || '(VITE_API_URL 미설정)'}</p>
      </main>
    </div>
  )
}
