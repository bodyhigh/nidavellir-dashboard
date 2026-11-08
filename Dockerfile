# Stage 1: Build static assets with Node.js
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

# Copy dependency manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Run typecheck and production build
RUN pnpm run typecheck && pnpm run build

# Stage 2: Hardened Alpine Nginx static server
FROM nginx:alpine-slim

# Copy compiled SPA bundle
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy hardened nginx configuration with strict CSP
COPY nginx.conf /etc/nginx/nginx.conf

# Metadata
EXPOSE 80

# Run in foreground
CMD ["nginx", "-g", "daemon off;"]
