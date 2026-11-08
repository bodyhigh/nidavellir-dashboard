# Nidavellir Mission Control Dashboard

[![Spec: Candidate v3](https://img.shields.io/badge/spec-Candidate%20v3%20Consensus-blue.svg)](#technical-consensus)
[![Node: v22.23.4](https://img.shields.io/badge/node-v22.23.4-green.svg)](#toolchain)
[![Security: Zero Secrets](https://img.shields.io/badge/security-Zero%20Secrets%20%7C%20Offline%20Ready-success.svg)](#security-architecture)
[![Host: Debian 13](https://img.shields.io/badge/host-Debian%2013%20trixie-red.svg)](#host-runtime)

A lightweight, self-hosted operational mission control dashboard for the **manifesting.art** autonomous agent swarm, purpose-built to run on the local host **Nidavellir** (`192.168.68.x`).

---

## Architectural Principles

1. **Zero Client Secrets:** The dashboard code contains 0 GitHub PATs, 0 OAuth tokens, and 0 API secrets. Client-side browser inspection reveals no credentials.
2. **100% Offline Resilience (Air-Gapped Ready):** In Phase 1 (Live Demo), the dashboard consumes a frozen offline data snapshot (`src/data/dashboard-snapshot.json`). During guest presentations or WAN / Starlink outages, the dashboard loads instantly (<100ms) with zero broken image placeholders or network timeout spinners.
3. **Hardened Container Isolation:** Packaged in a minimal `nginx:alpine-slim` container configured with `read_only: true`, tmpfs mounts for ephemeral directories, and a strict Content Security Policy (`default-src 'self'`).
4. **Explicit LAN Binding:** Port 3456 binds strictly to the host's private LAN IP (`192.168.68.x`), preventing exposure to unintended interfaces.
5. **Native Docker Supervision:** Uses `restart: unless-stopped` under Docker Engine supervision to survive host reboots without supervision race conditions.

---

## Technical Consensus

This repository implements the architecture agreed upon in **Candidate v3** by the engineering and security team:

- **Craig** (House Host / System Operator)
- **Cereal Killer** (Release Engineer & Test Harness Pilot)
- **Zero Cool** (Security Red Team & Threat Modeler)
- **Antigravity** (Lead Architect & Workspace Orchestrator)

Consensus document: `reviews/pr-review-20261107/NIDAVELLIR_DASHBOARD_CONSENSUS_PLAN_AND_STORIES.md`.

---

## User Stories & Implementation Matrix

| Story Key       | Priority | Title                                                  | Implementation Status                                         |
| :-------------- | :------- | :----------------------------------------------------- | :------------------------------------------------------------ |
| **`INFRA-001`** | **P0**   | Revoke Compromised Prototype Token & Purge Cache       | **HELD — Pending Craig's Approval** (GitHub Token Revocation) |
| **`INFRA-002`** | **P1**   | Scaffold Vite + React Offline Dashboard SPA            | **COMPLETE** (`src/`, `snapshot.json`, Typechecked)           |
| **`INFRA-003`** | **P1**   | Containerize Dashboard with Hardened Nginx & CSP       | **COMPLETE** (`Dockerfile`, `nginx.conf`)                     |
| **`INFRA-004`** | **P1**   | Deploy Container on Nidavellir with Daemon Supervision | **CONFIGURED** (`docker-compose.yml`, LAN IP binding)         |
| **`INFRA-005`** | **P2**   | Tablet E2E & Simulated Outage UAT                      | **READY** (iPad LAN verification)                             |
| **`INFRA-006`** | **P3**   | Phase 2 Read-Only Token Proxy for Automated Sync       | **BACKLOG** (Post-Demo Phase)                                 |

---

## Dashboard Panels

The Single Page Application is divided into three high-density operational panels:

1. **Release & PR Baseline:**
   - Integration baseline status for `bodyhigh/manifesting-ui` and `bodyhigh/manifesting-api`.
   - Baseline commit `2121eeb` locked on `origin/main`.
   - Vitest automated test suite verification (75 / 75 passing, 100% pass rate).
   - Pre-flight automated CI/CD checks (Typecheck, Vitest, OpenAPI contracts, Deployment env, Staging bindings).

2. **Autonomous Agent Team:**
   - Real-time status cards for active swarm agents:
     - **Antigravity:** Lead Architect & Workspace Orchestrator
     - **Cereal Killer:** Release Engineer & Test Harness Pilot
     - **Zero Cool:** Security Red Team & Threat Modeler
     - **Codex:** Autonomous Code Generator & Bridge Peer
   - Interactive inspection modal displaying active assignment, engine model, runtime tier, and checkpoint.

3. **System & Infrastructure Assurance:**
   - Host environment: Debian GNU/Linux 13 (trixie), Linux kernel 6.12, systemd PID 1.
   - Pinned toolchain: Node.js v22.23.4, pnpm v11.25.0 with strict supply-chain policies.
   - Security headers: Strict CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
   - Starlink outage resilience metrics.

---

## Toolchain & Verification

Use the pinned Node.js runtime and pnpm package manager:

```bash
# Set PATH to pinned runtime binaries
export PATH="/home/moreno/.cache/manifesting-art/node22-v22.23.4/bin:/home/moreno/.gemini/antigravity/scratch/nidavellir/bin:$PATH"

# Typecheck
pnpm run typecheck

# Production Build
pnpm run build

# Local Dev Server
pnpm run dev
```

---

## Docker Deployment on Nidavellir

### 1. Build and Run via Docker Compose

```bash
# Optional: Set host LAN IP (defaults to 192.168.68.64)
export DASHBOARD_BIND_IP="192.168.68.64"

# Build and start container in detached mode
docker compose up -d --build
```

### 2. Verify Port Binding & Health

```bash
# Verify process listening on explicit LAN IP
ss -ltn | grep 3456

# Check container status
docker ps -f name=nidavellir-dashboard

# Test HTTP response
curl -I http://192.168.68.64:3456/
```

### 3. Security Verification

Inspect HTTP response headers:

```bash
curl -i http://192.168.68.64:3456/ | grep -E "Content-Security-Policy|X-Frame-Options|X-Content-Type-Options"
```

Expected output:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```
