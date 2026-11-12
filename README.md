# Nidavellir Mission Control Dashboard

[![Spec: Candidate v3 + Live Sidecar](https://img.shields.io/badge/spec-Candidate%20v3%20%2B%20Live%20Sidecar-blue.svg)](#technical-consensus)
[![Node: v22.23.5](https://img.shields.io/badge/node-v22.23.5-green.svg)](#toolchain--verification)
[![Security: Zero Client Secrets](https://img.shields.io/badge/security-Zero%20Client%20Secrets%20%7C%20Hybrid%20Offline%20Ready-success.svg)](#architectural-principles)
[![Host: Debian 13](https://img.shields.io/badge/host-Debian%2013%20trixie-red.svg)](#dashboard-panels)

A lightweight, self-hosted operational mission control dashboard for the **manifesting.art** autonomous agent swarm, purpose-built to run on the local host **Nidavellir** (`192.168.68.x`).

---

## Architectural Principles

1. **Zero Client Secrets:** Client-side bundles contain 0 GitHub PATs, 0 OAuth tokens, and 0 API secrets. Any optional `GITHUB_TOKEN` stays strictly inside the server-side `collector` sidecar container (`INFRA-006` / `INFRA-008`).
2. **Live Telemetry + 100% Offline Resilience (`INFRA-007`..`INFRA-011`):** On load and every 30 seconds, the SPA fetches live telemetry from `GET /api/dashboard` via a same-origin Nginx reverse proxy (`connect-src 'self'`). If GitHub is unreachable (Starlink drop), the collector serves its atomic disk-cached baseline merged with live local host probes (`CACHED TELEMETRY MODE`). If the collector sidecar itself is unavailable, the SPA renders its bundled `src/data/dashboard-snapshot.json` in `<100ms` (`OFFLINE SNAPSHOT FALLBACK`).
3. **Hardened Container Isolation:** Both the `nginx:alpine-slim` frontend container and the Node.js collector sidecar run with `read_only: true`, tmpfs mounts for `/tmp`, and strict HTTP security headers (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`).
4. **Explicit LAN Binding:** Port 3456 binds strictly to the host's private LAN IP (`192.168.68.x`), while the collector sidecar (`:3001`) remains isolated on the internal Docker compose network.
5. **Native Docker Supervision:** Uses `restart: unless-stopped` under Docker Engine supervision to survive host reboots without manual intervention.

---

## Technical Consensus

This repository implements the architecture agreed upon in **Candidate v3** and the **Live Telemetry Sidecar Extensions (`INFRA-007`..`INFRA-011`)**:

- **Craig** (House Host / System Operator)
- **Cereal Killer** (Release Engineer & Test Harness Pilot)
- **Zero Cool** (Security Red Team & Threat Modeler)
- **Antigravity** (Lead Architect & Workspace Orchestrator)

---

## User Stories & Implementation Matrix

| Story Key       | Priority | Title                                                   | Implementation Status                                                     |
| :-------------- | :------- | :------------------------------------------------------ | :------------------------------------------------------------------------ |
| **`INFRA-001`** | **P0**   | Revoke Compromised Prototype Token & Purge Cache        | **HELD — Host Disk & Git Verified Clean** (Awaiting GitHub UI check)      |
| **`INFRA-002`** | **P1**   | Scaffold Vite + React Offline Dashboard SPA             | **COMPLETE** (`src/`, `dashboard-snapshot.json`, Typechecked)             |
| **`INFRA-003`** | **P1**   | Containerize Dashboard with Hardened Nginx & CSP        | **COMPLETE** (`Dockerfile`, `nginx.conf` all locations hardened)          |
| **`INFRA-004`** | **P1**   | Deploy Container on Nidavellir with Daemon Supervision  | **COMPLETE** (`docker-compose.yml`, healthchecks, LAN IP binding)         |
| **`INFRA-005`** | **P2**   | Tablet E2E & Simulated Outage UAT                       | **READY** (Instant fallback to cached/bundled data on WAN drop)           |
| **`INFRA-006`** | **P3**   | Phase 2 Read-Only Token Proxy for Automated Sync        | **COMPLETE** (Consolidated into `INFRA-008` server-side collector)        |
| **`INFRA-007`** | **P1**   | Live Data Fetching (Replace Hardcoded/Stale Snapshot)   | **COMPLETE** (`collector/` + live polling in `src/App.tsx`)               |
| **`INFRA-008`** | **P1**   | Local Live-Data Collector / Sidecar API Service         | **COMPLETE** (`collector/server.mjs`, `collector/probes.mjs`, unit tests) |
| **`INFRA-009`** | **P1**   | Nginx `/api/` Reverse Proxy & Security Header Alignment | **COMPLETE** (`nginx.conf` `location /api/` with strict CSP & `no-store`) |
| **`INFRA-010`** | **P2**   | Live Nidavellir Agent & Host Health Probes              | **COMPLETE** (Probes sockets, gateway state, `statfs`, load, memory)      |
| **`INFRA-011`** | **P2**   | Frontend Polling, Manual Refresh & Staleness/Offline UI | **COMPLETE** (30s polling, manual refresh, accessible `<progress>` ring)  |

---

## Toolchain & Verification

Install the Node.js version in `.nvmrc` with `nvm install` and select it with `nvm use`.
On Nidavellir, the same version can be selected from the local runtime directory:

```bash
export PATH="$HOME/.cache/manifesting-art/node22-v$(cat .nvmrc)/bin:$PATH"
```

Enable the pinned pnpm package manager and run the checks:

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate

# Typecheck
pnpm run typecheck

# Run Collector Unit & Integration Tests
pnpm test

# Check Formatting
pnpm run format:check

# Production Build
pnpm run build

# Run Local Collector + Vite Dev Server
pnpm run collector &
pnpm run dev
```
