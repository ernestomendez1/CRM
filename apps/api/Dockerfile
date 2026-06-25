# syntax=docker/dockerfile:1.7

FROM node:24.5-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Stage 1: prune monorepo to only what @crm/api needs.
FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2.10.0 prune @crm/api --docker

# Stage 2: install + build + deploy a self-contained prod bundle.
FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm --filter @crm/api build
RUN pnpm --filter @crm/api deploy --prod /deploy

# Stage 3: minimal runtime.
FROM node:24.5-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Fonts so @react-pdf/renderer can render invoices/quotations
# (PDF routes migrate from web to api in Phase 2).
RUN apk add --no-cache font-noto font-noto-emoji

COPY --from=installer /deploy/dist ./dist
COPY --from=installer /deploy/package.json ./package.json
COPY --from=installer /deploy/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/index.js"]
