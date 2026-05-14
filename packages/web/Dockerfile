FROM oven/bun:1 AS builder

WORKDIR /app

# Install deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN bun run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM oven/bun:1-slim

WORKDIR /app

# Only what's needed at runtime
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/api ./src/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "src/api/server.ts"]
