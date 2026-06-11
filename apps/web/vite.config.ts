import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const allowedHosts = ['.up.railway.app']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // .env를 모노레포 루트에서 로드(api의 env.ts와 동일 소스). raw `pnpm dev`로 띄워도
  // VITE_API_URL을 읽어 hasBackend=true가 된다. VITE_ 접두사만 클라이언트에 노출되므로
  // GOOGLE_* 등 서버 시크릿은 그대로 안전. docker는 compose의 process.env 주입이 계속 동작.
  envDir: '../../',
  server: {
    host: true, // 컨테이너 외부에서 접근 가능하게
    allowedHosts,
    port: 5173,
  },
  preview: {
    host: true,
    allowedHosts,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
