# Clinic Appointment Scheduling — Project Execution Blueprint

## Project Overview

A full-stack clinic appointment scheduling web application built with Next.js (App Router), TypeScript, PostgreSQL (Prisma ORM), and N8N workflow automation. Deployed on Vercel with Docker-based local development.

## Architecture Summary

- **Frontend:** Next.js 14+ (App Router), shadcn/ui, Tailwind CSS, Lucide Icons
- **State:** TanStack Query v5 (server state), Zustand (client-only shared state)
- **Auth:** Auth.js (NextAuth v5) — Email/Password + Google OAuth, RBAC
- **API:** Next.js API Routes + Server Actions, Zod validation
- **Database:** PostgreSQL + Prisma ORM (UUID PKs, TIMESTAMPTZ)
- **Workflow:** N8N (self-hosted Docker) — HMAC-signed webhooks
- **Deployment:** Vercel (production), Docker Compose (local dev)

## Rule Framework

All development strictly follows rules defined in `rules/`:

- `gitflow.mdc` — Gitflow branching, conventional commits, PR template
- `nextjs-typescript-*.mdc` — Next.js + TypeScript + shadcn/ui + Tailwind
- `postgresql.mdc` — UUID PKs, TIMESTAMPTZ, parameterized queries, indexes
- `docker.mdc` — Multi-stage builds, non-root user, pinned versions
- `security-devsecops-*.mdc` — Auth framework, SAST/SCA, secret scanning
- `vercel-deployment.mdc` — Security headers, middleware, edge functions
- `jest-unit-testing-*.mdc` — Mock-first testing, edge cases
- `clean-code.mdc`, `anti-overengineering.mdc`, `codequality.mdc`

---

## Phase 0 — Foundation & Scaffolding ✅

### Goal

Initialize the complete project skeleton with all tooling, configurations, CI/CD, and infrastructure-as-code files. No business logic yet — just the scaffold.

### Steps

| #   | Step                                                                               | Status | Notes                                         |
| --- | ---------------------------------------------------------------------------------- | ------ | --------------------------------------------- |
| 1   | Initialize Next.js project (App Router, TypeScript, Tailwind, ESLint, src/)        | ✅     | Next.js 16.2.10, React 19.2.4                 |
| 2   | Install dev deps: prettier, husky, lint-staged, commitlint                         | ✅     | With conventional commit config               |
| 3   | Configure `tsconfig.json` strict mode + `noUncheckedIndexedAccess`                 | ✅     | strict: true, noUncheckedIndexedAccess: true  |
| 4   | Configure Tailwind + shadcn/ui init + globals.css                                  | ✅     | Tailwind v4, shadcn/ui 4.13.1                 |
| 5   | Install core deps: zustand, @tanstack/react-query, next-auth, zod, react-hook-form | ✅     | + date-fns, uuid, bcryptjs                    |
| 6   | Install & init Prisma (schema, client, db.ts singleton)                            | ✅     | Prisma 7.8 with adapter-pg                    |
| 7   | Create initial Prisma schema + seed + migration                                    | ✅     | 6 models + enums; seed pending DB             |
| 8   | Create Auth.js config (Credentials + Google)                                       | ✅     | Dynamic db import for Edge compat             |
| 9   | Create Proxy (auth guards) — Next.js 16                                            | ✅     | proxy.ts instead of middleware.ts             |
| 10  | Create N8N webhook handler (HMAC validation) + outbound action                     | ✅     | HMAC SHA-256 verification                     |
| 11  | Create Dockerfile (multi-stage, non-root, standalone output)                       | ✅     | node:20-alpine, HEALTHCHECK, standalone       |
| 12  | Create docker-compose.yml (app + postgres:16 + n8n)                                | ✅     | Custom bridge network                         |
| 13  | Create .dockerignore                                                               | ✅     |                                               |
| 14  | Create vercel.json (security headers)                                              | ✅     | X-Content-Type-Options, X-Frame-Options, etc. |
| 15  | Create GitHub Actions: ci.yml, security-scan.yml                                   | ✅     | PostgreSQL service, trufflehog scan           |
| 16  | Create PULL_REQUEST_TEMPLATE.md                                                    | ✅     | Checklist for style, tests, security          |
| 17  | Set up Husky pre-commit hooks                                                      | ✅     | lint-staged + commitlint                      |
| 18  | Verify: lint, typecheck, build all pass                                            | ✅     | Zero errors, zero warnings                    |

---

## Phase 1 — Database Schema & Migrations ✅

### Status: Completed ✅

### Steps

| #   | Step                                         | Status | Notes                                                |
| --- | -------------------------------------------- | ------ | ---------------------------------------------------- |
| 1   | Stop local PostgreSQL service                | ✅     | Service stopped, port 5432 freed                     |
| 2   | Docker Compose up (app + postgres:16 + n8n)  | ✅     | All 3 containers healthy                             |
| 3   | Prisma migration (`migrate dev --name init`) | ✅     | Migration `20260718113742_init` applied              |
| 4   | Seed database (`prisma db seed`)             | ✅     | 4 users, 1 provider, 1 patient, 5 availability slots |
| 5   | Verify connectivity                          | ✅     | Health endpoint returns `{"status":"ok"}`            |

## Phase 2 — Authentication & Authorization

_Not started_

## Phase 3 — Core API

_Not started_

## Phase 4 — UI/UX

_Not started_

## Phase 5 — N8N Integration

_Not started_

## Phase 6 — Testing

_Not started_

## Phase 7 — Production Hardening & Deployment

_Not started_

---

## Implementation Log — Phase 0

**Status:** Completed ✅

**Summary of Work:**

1. Initialized Next.js 16 project with TypeScript, Tailwind v4, and shadcn/ui
2. Configured strict TypeScript (`strict: true`, `noUncheckedIndexedAccess`), ESLint, Prettier, Husky + lint-staged, commitlint (conventional commits)
3. Set up Prisma ORM 7.8 with PostgreSQL adapter (`@prisma/adapter-pg`), 6 models, UUID PKs, TIMESTAMPTZ, proper indexes and FKs
4. Implemented multi-stage Dockerfile (node:20-alpine, non-root `appuser`, `output: 'standalone'`, `HEALTHCHECK`)
5. Configured CI/CD (GitHub Actions: lint, typecheck, build, Prisma migrate, trufflehog secret scan)
6. Implemented N8N webhook security with HMAC SHA-256 (`timingSafeEqual`) — both inbound verification and outbound signing
7. Set up Auth.js (NextAuth v5) with Credentials + Google OAuth providers, RBAC-ready `Role` enum, and dynamic `db` import for Edge runtime compatibility
8. Configured Next.js 16 Proxy (`src/proxy.ts`) for auth guard, replacing deprecated middleware pattern
9. Created `vercel.json` with security headers, `docker-compose.yml` (app + postgres:16 + n8n), PR template
10. Verified: `npm run lint` — 0 errors, `npm run typecheck` — 0 errors, `npm run build` — 0 errors, 0 warnings

---

## Implementation Log — Phase 1

**Status:** Completed ✅

**Summary of Work:**

1. Stopped local PostgreSQL Windows service to free port 5432
2. Launched Docker Compose stack (app + postgres:16-alpine + n8n:1.90.2) on custom bridge network
3. Fixed Dockerfile Node.js version (`20.18` → `20-alpine3.20`) to satisfy Prisma 7.8 Node >=20.19 requirement
4. Created root `.dockerignore` to prevent massive build context (was sending 900MB+ of node_modules)
5. Fixed Dockerfile `npm ci --only=production` by adding `--ignore-scripts` (husky is devDep)
6. Restructured Dockerfile to install all deps for build, then strip devDeps for final image
7. Fixed HEALTHCHECK to use `127.0.0.1` instead of `localhost` (IPv6 resolution issue in Alpine)
8. Applied initial Prisma migration `20260718113742_init`
9. Seeded database with: admin, provider/doctor, receptionist, patient users + availability slots
10. Verified: app health endpoint returns `{"status":"ok"}`

---

## Progress Log

| Date       | Phase | Step | Status | Notes                                                                          |
| ---------- | ----- | ---- | ------ | ------------------------------------------------------------------------------ |
| 2026-07-18 | 0     | 1-18 | ✅     | Phase 0 complete — scaffold, tooling, CI/CD, Docker, Prisma, Auth, N8N webhook |
| 2026-07-18 | 1     | 1-5  | ✅     | Phase 1 complete — Docker containers up, migration applied, DB seeded          |

---

## Next Goals — Phase 2 Start

### Phase 2: Authentication & Authorization (Build)

1. Complete Auth.js setup with Credentials + Google OAuth
2. Implement RBAC middleware checks at the proxy layer
3. Build login and registration pages
4. Add session management with TanStack Query prefetch
5. Verify all auth flows (unauthenticated redirect, role-based access)
