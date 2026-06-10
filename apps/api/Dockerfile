# 개발용 이미지 (핫리로드는 compose의 bind-mount + tsx watch로).
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

# 워크스페이스 매니페스트 먼저 복사 → 의존성 레이어 캐시
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install

COPY apps/api apps/api
WORKDIR /app/apps/api

EXPOSE 8787
CMD ["pnpm", "dev"]
