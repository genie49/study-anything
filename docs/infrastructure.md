# 인프라 (로컬 개발 — Docker 기반)

> 관련: [데이터 모델](./data-model.md) · [파이프라인](./data-pipeline.md) · [런타임 채점](./runtime-grading.md)

pnpm 모노레포 + docker-compose로 **앱(프론트/백)과 인프라(Mongo/Redis)를 한 번에** 띄운다.

## 구조

```
study-anything/
├── apps/
│   ├── web/   # 프론트: Vite + React 19 + Tailwind v4 + vitest      (:5173)
│   └── api/   # 백: Hono on Node(@hono/node-server) + tsx watch     (:8787)
├── docker-compose.yml   # web · api · mongo · redis
├── pnpm-workspace.yaml  # apps/* 워크스페이스
├── .env.example         # 복사 → .env (gitignore)
└── docs/
```

| 서비스 | 이미지/런타임 | 포트 | 비고 |
|---|---|---|---|
| web | node:22-alpine (Vite dev) | 5173 | bind-mount 핫리로드 |
| api | node:22-alpine (tsx watch) | 8787 | `/health` 제공, Mongo/Redis 연결 |
| mongo | `mongo:7` | 27017 | named volume `mongo-data`, healthcheck |
| redis | `redis:7-alpine` | 6379 | named volume `redis-data`, healthcheck |

## 실행

```bash
cp .env.example .env        # GEMINI_API_KEY 등 채우기(.env는 커밋 안 됨)
docker compose up --build   # 또는: pnpm dev:build
# web  → http://localhost:5173
# api  → http://localhost:8787/health
```

- 첫 실행은 이미지 빌드 + `pnpm install`로 시간이 걸린다. 이후는 캐시.
- 소스는 bind-mount라 컨테이너 재빌드 없이 핫리로드(web=Vite HMR, api=tsx watch).
- 종료: `docker compose down` (데이터 유지) / 볼륨까지: `docker compose down -v`.

### Docker 없이 로컬 실행

```bash
pnpm install
# Mongo/Redis는 별도로 띄우고 .env의 MONGO_URL/REDIS_URL을 localhost로
pnpm api   # apps/api dev
pnpm web   # apps/web dev
pnpm test  # 전체 워크스페이스 테스트(vitest)
```

## 환경변수

| 변수 | 용도 | 비고 |
|---|---|---|
| `GEMINI_API_KEY` | 런타임 채점 LLM | **서버(api)만**, 절대 프론트 노출 금지 |
| `GRADER_MODEL` | 채점 모델 | 기본 `gemini-3.1-flash-lite` |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | 구글 OAuth | 서버만([auth.md](./auth.md)) |
| `JWT_SECRET` · `ACCESS_TTL` · `REFRESH_TTL` | JWT 서명·수명 | 서버만 |
| `WEB_ORIGIN` | CORS·쿠키 origin | 프론트 주소 |
| `MONGO_URL` | Mongo 접속 | compose는 `mongodb://mongo:27017/study` 주입 |
| `REDIS_URL` | Redis 접속 | compose는 `redis://redis:6379` 주입 |
| `PORT` | api 포트 | 기본 8787 |
| `VITE_API_URL` | 프론트→백 주소 | 기본 `http://localhost:8787` |

## Redis 용도 (설계 의도)

DB가 진실원천이고 status/진도/플랜은 [요청 시 계산](./data-model.md#01-저장-vs-파생--미리-만드나-요청-시-만드나)이므로 Redis는 **필수 경로가 아니다**. 다음 용도로만 둔다:
- on-demand 집계의 **선택적 캐시**(진도 누계 등) — 느려질 때만.
- 향후 채점 LLM **레이트리밋** / 세션 토큰 저장.

지금은 연결만 세팅(`apps/api/src/db/redis.ts`)하고 실사용은 후속.

## 범위 (현재 스캐폴드)

- ✅ 모노레포 + compose로 4서비스 기동, api `/health`, Mongo/Redis 연결 모듈, 양쪽 vitest 스모크.
- ⬜ 프로덕션 멀티스테이지 이미지, API 라우트/도메인 로직, import 스크립트의 compose 편입, CI.
