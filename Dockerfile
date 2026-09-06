# pnpm 11 : allowBuilds n'est appliqué en Docker que si CI=true (pas de TTY).
FROM node:22-alpine AS base

ENV CI=true

RUN apk add --no-cache \
        libc6-compat \
        openssl \
    && corepack enable \
    && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app


# --- Backend : dépendances ---
FROM base AS backend-deps

WORKDIR /app/backend

COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile


# --- Backend : build Nest + client Prisma ---
FROM base AS backend-builder

WORKDIR /app/backend

COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./

# Prisma 7 lit DATABASE_URL au `generate` via prisma.config.ts (valeur fictive).
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

RUN pnpm db:generate && pnpm build


# --- Migrations (job unique, restart: "no") ---
FROM base AS migrator

WORKDIR /app/backend

COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
COPY backend/prisma.config.ts ./
COPY backend/prisma ./prisma
COPY backend/scripts/docker-migrate.sh ./scripts/docker-migrate.sh

RUN chmod 0755 ./scripts/docker-migrate.sh

CMD ["./scripts/docker-migrate.sh"]


# --- API Nest en production ---
FROM base AS api

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nestjs

COPY --from=backend-builder --chown=nestjs:nodejs /app/backend/node_modules ./node_modules
COPY --from=backend-builder --chown=nestjs:nodejs /app/backend/dist ./dist
COPY --from=backend-builder --chown=nestjs:nodejs /app/backend/package.json ./

USER nestjs

EXPOSE 4000

# nest build compile aussi prisma/ (hors src/) : le point d'entrée est dist/src/main.js
CMD ["node", "dist/src/main.js"]


# --- Frontend : dépendances ---
FROM base AS frontend-deps

WORKDIR /app/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile


# --- Frontend : build Vite (VITE_API_URL est figé ici, pas au runtime) ---
FROM base AS frontend-builder

WORKDIR /app/frontend

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY --from=frontend-deps /app/frontend/node_modules ./node_modules
COPY frontend/ ./

RUN pnpm build


# --- SPA servie par nginx ---
FROM nginx:1.27-alpine AS web

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
