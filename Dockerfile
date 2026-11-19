FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS node-base

# Stage 1: Build static assets with Node.js
FROM node-base AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

# Copy dependency manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Run typecheck, collector tests, and production build
RUN pnpm run typecheck && node --test collector/collector.test.mjs && pnpm run build

# Stage 2: Hardened Node.js Live Telemetry Collector Sidecar (INFRA-008 / INFRA-010)
FROM node-base AS collector

WORKDIR /app
ENV NODE_ENV=production
ENV COLLECTOR_BIND_HOST=0.0.0.0
ENV COLLECTOR_PORT=3001

COPY --chown=node:node collector ./collector
COPY --chown=node:node src/data/dashboard-snapshot.json ./src/data/dashboard-snapshot.json

USER node
EXPOSE 3001

CMD ["node", "collector/server.mjs"]

# Stage 3: Hardened Alpine Nginx static server + /api/ reverse proxy (INFRA-003 / INFRA-009)
FROM nginx:alpine-slim AS dashboard

# Copy compiled SPA bundle
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy hardened nginx configuration with strict CSP and /api/ reverse proxy
COPY nginx.conf /etc/nginx/nginx.conf

# Metadata
EXPOSE 80

# Run in foreground
CMD ["nginx", "-g", "daemon off;"]
