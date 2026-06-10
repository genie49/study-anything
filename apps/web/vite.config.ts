import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // 컨테이너 외부에서 접근 가능하게
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
