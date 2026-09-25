### ---------- BUILDER ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Prisma build-time env (dummy)
ARG DATABASE_URL=postgresql://user:pass@localhost:5432/db
ENV DATABASE_URL=$DATABASE_URL
ENV NEON_PG_DATABASE_URL=$DATABASE_URL

COPY package*.json ./
RUN npm ci 

COPY . .

RUN npm run prisma:generate \
  && npm run build \
  && npm run css:build \
  && npm prune --omit=dev

### ---------- RUNTIME ----------
FROM node:20-alpine

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/src/views ./src/views

RUN chown -R appuser:appgroup /app

ENV NODE_ENV=production
ENV PORT=8080
ENV TZ=UTC

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/health', r => { if(r.statusCode !== 200) process.exit(1); }).on('error', () => process.exit(1));"

EXPOSE 8080

CMD ["node", "dist/index.js"]