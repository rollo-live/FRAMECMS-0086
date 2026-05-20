# ─── Stage 1: Build React frontend ───────────────────────────────────────────
FROM oven/bun:1.3.5-debian AS builder

# Override any injected frozen-lockfile setting
ENV BUN_CONFIG_FROZEN_LOCKFILE=false

WORKDIR /app

# Copy root workspace manifests
COPY package.json bun.lock ./

# Copy web package manifest
COPY packages/web/package.json ./packages/web/

# Stub mobile & desktop so workspace install doesn't fail
RUN mkdir -p packages/mobile packages/desktop \
  && echo '{"name":"mobile","version":"0.0.0"}' > packages/mobile/package.json \
  && echo '{"name":"desktop","version":"0.0.0"}' > packages/desktop/package.json

# Install all deps (dev included — needed for vite build)
RUN bun install

# Copy web source
COPY packages/web ./packages/web

# Build Vite frontend
WORKDIR /app/packages/web
RUN bun run build

# ─── Stage 2: Production runtime ─────────────────────────────────────────────
FROM oven/bun:1.3.5-debian AS runner

ENV BUN_CONFIG_FROZEN_LOCKFILE=false

WORKDIR /app

# Copy manifests
COPY package.json bun.lock ./
COPY packages/web/package.json ./packages/web/

# Stub unused workspaces
RUN mkdir -p packages/mobile packages/desktop \
  && echo '{"name":"mobile","version":"0.0.0"}' > packages/mobile/package.json \
  && echo '{"name":"desktop","version":"0.0.0"}' > packages/desktop/package.json

# Reuse node_modules from builder (already compiled, no gcc needed)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/web/node_modules ./packages/web/node_modules

# Copy API source
COPY packages/web/src ./packages/web/src

# Copy built frontend
COPY --from=builder /app/packages/web/dist ./packages/web/dist

# Non-root user
RUN groupadd -r frame && useradd -r -g frame frame \
  && chown -R frame:frame /app
USER frame

WORKDIR /app/packages/web

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["bun", "run", "./src/api/server.ts"]
