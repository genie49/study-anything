// 로컬 dev(.env 자동로드) — config가 평가되기 전에 import되어야 함(index.ts 첫 줄).
// 의존성 없이 Node 내장 process.loadEnvFile 사용. docker는 compose env_file이 주입하므로
// .env가 없거나 미지원 Node여도 조용히 통과.
import { resolve } from 'node:path'

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(resolve(import.meta.dirname, '../../../.env')) // repo 루트의 .env
  }
} catch {
  /* .env 없음(docker가 env_file로 주입) — 무시 */
}
