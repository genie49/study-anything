# 개발용 이미지 (핫리로드는 compose의 bind-mount로). 프로덕션 빌드는 후속.
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

# 워크스페이스 매니페스트 먼저 복사 → 의존성 레이어 캐시
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install

COPY apps/web apps/web
WORKDIR /app/apps/web

EXPOSE 5173
CMD ["pnpm", "dev"]
