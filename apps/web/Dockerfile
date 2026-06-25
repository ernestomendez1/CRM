# syntax=docker/dockerfile:1.7

FROM node:24.5-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Stage 1: prune monorepo to only what @crm/web needs.
FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@2.10.0 prune @crm/web --docker

# Stage 2: install + build (single stage to preserve pnpm symlinks).
FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm --filter @crm/web build

# Stage 3: minimal runtime.
FROM node:24.5-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone bundle: includes apps/web/server.js + minimal
# node_modules + traced workspace packages (thanks to
# outputFileTracingRoot in next.config.ts).
COPY --from=installer /repo/apps/web/.next/standalone ./
COPY --from=installer /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer /repo/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
