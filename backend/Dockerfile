### ---------- BUILDER ----------
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Prisma build-time env (dummy)
ARG DATABASE_URL=postgresql://user:pass@localhost:5432/db
ENV DATABASE_URL=$DATABASE_URL
ENV NEON_PG_DATABASE_URL=$DATABASE_URL

COPY package.json bun.lock* ./
RUN bun install

COPY . .

RUN bun run prisma:generate \
  && bun run build \
  && bun run css:build

### ---------- RUNTIME ----------
FROM oven/bun:1-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/src/views ./src/views

ENV NODE_ENV=production
ENV PORT=8080
ENV TZ=UTC

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + process.env.PORT + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 8080

CMD ["bun", "dist/index.js"]
