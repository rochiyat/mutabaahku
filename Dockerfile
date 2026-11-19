# syntax=docker/dockerfile:1

# ---- Build frontend ----
FROM node:24-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --include-workspace-root=false
COPY frontend frontend
RUN npm run build --workspace frontend

# ---- Runtime: API + built frontend on one origin ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    STATIC_DIR=/app/public
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace backend --include-workspace-root=false && npm cache clean --force
COPY backend backend
COPY --from=web /app/frontend/dist public

USER node
WORKDIR /app/backend
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

# Migrasi + seed aman dijalankan setiap start (seed hanya mengisi tabel kosong).
CMD ["sh", "-c", "npm run migrate --silent && npm run seed --silent && exec node src/server.js"]
