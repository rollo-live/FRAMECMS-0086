# ─── Stage 1: Build React frontend ───────────────────────────────────────────
FROM oven/bun:1.3.5-alpine AS builder

WORKDIR /app

# Copy package files first (layer cache)
COPY package.json bun.lockb ./
COPY packages/web/package.json ./packages/web/
# Stub other workspaces so bun install doesn't fail
RUN mkdir -p packages/mobile packages/desktop \
  && echo '{"name":"mobile","version":"0.0.0"}' > packages/mobile/package.json \
  && echo '{"name":"desktop","version":"0.0.0"}' > packages/desktop/package.json

# Install ALL deps (including devDeps needed for build)
RUN bun install --frozen-lockfile

# Copy source
COPY packages/web ./packages/web

# Build Vite frontend (outputs to packages/web/dist)
WORKDIR /app/packages/web
RUN bun run build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM oven/bun:1.3.5-alpine AS runner

WORKDIR /app

# Only copy what's needed at runtime
COPY package.json bun.lockb ./
COPY packages/web/package.json ./packages/web/
RUN mkdir -p packages/mobile packages/desktop \
  && echo '{"name":"mobile","version":"0.0.0"}' > packages/mobile/package.json \
  && echo '{"name":"desktop","version":"0.0.0"}' > packages/desktop/package.json

# Install production deps only
RUN bun install --frozen-lockfile --production

# Copy API source (Bun runs TS directly — no compile needed)
COPY packages/web/src ./packages/web/src

# Copy built frontend from builder stage
COPY --from=builder /app/packages/web/dist ./packages/web/dist

# Non-root user for security
RUN addgroup -S frame && adduser -S frame -G frame
USER frame

WORKDIR /app/packages/web

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["bun", "run", "./src/api/server.ts"]
