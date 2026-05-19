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

# Override any injected frozen-lockfile setting
ENV BUN_CONFIG_FROZEN_LOCKFILE=false

# Install native lib deps for sharp + tensorflow
RUN apt-get update && apt-get install -y --no-install-recommends \
  libvips-dev \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests
COPY package.json bun.lock ./
COPY packages/web/package.json ./packages/web/

# Stub unused workspaces
RUN mkdir -p packages/mobile packages/desktop \
  && echo '{"name":"mobile","version":"0.0.0"}' > packages/mobile/package.json \
  && echo '{"name":"desktop","version":"0.0.0"}' > packages/desktop/package.json

# Install production deps (includes native module compilation)
RUN bun install --production --no-frozen-lockfile

# Copy API source (Bun runs TS directly)
COPY packages/web/src ./packages/web/src

# Copy built frontend from builder stage
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
