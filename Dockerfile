# Multi-stage: build shared + api + web, run API serving SPA
FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web

RUN npm run build -w @maxitexs/shared \
 && npm run build -w @maxitexs/api \
 && npm run build -w @maxitexs/web \
 && npm prune --omit=dev

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=America/Caracas \
    WEB_DIST=/app/apps/web/dist

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrate then serve (works on Render / Fly / VPS without a separate pre-deploy step)
CMD ["sh", "-c", "node apps/api/dist/db/migrate.js && node apps/api/dist/index.js"]
