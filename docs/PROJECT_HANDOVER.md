# Project Handover — Clinic Management System

> **AI AGENT INSTRUCTIONS**: When starting a new session, read this entire file FIRST to restore project context before writing any code.

---

## 1. Project Overview & Stack

A full-stack clinic management application built with:

| Layer             | Technology                                                               |
| ----------------- | ------------------------------------------------------------------------ |
| **Framework**     | Next.js 16.2.10 (App Router, Turbopack)                                  |
| **ORM**           | Prisma 7.8.0 with `@prisma/adapter-pg` (driver adapter)                  |
| **Database**      | PostgreSQL (Neon serverless)                                             |
| **Auth**          | NextAuth v5 (beta) with Credentials provider                             |
| **Forms**         | react-hook-form + zod 4                                                  |
| **Styling**       | Tailwind CSS v4 + `tailwind-merge` + `clsx` + `class-variance-authority` |
| **UI Primitives** | `@base-ui/react`                                                         |
| **Icons**         | lucide-react                                                             |
| **Charting**      | recharts 3.9.2                                                           |
| **State/Data**    | zustand + @tanstack/react-query                                          |
| **Dates**         | date-fns 4                                                               |
| **Webhooks**      | n8n workflow automation                                                  |

### Core Architectural Patterns

- **Server Actions**: Business logic lives in `src/server/actions/*.ts`. Each action returns `ActionResult<T>` (`{ success, data } | { success, error }`). Actions check auth via `auth()` from NextAuth and enforce RBAC at the action level.
- **RBAC via RoleGuard**: A reusable `<RoleGuard allowedRoles={[...]}>` component wraps UI sections. Roles: `ADMIN`, `PROVIDER`, `RECEPTIONIST`, `PATIENT`.
- **Zod Validation**: Every server action validates `FormData` with a Zod schema before processing.
- **HMAC-Secured Webhook**: The n8n endpoint (`/api/webhooks/n8n`) uses SHA-256 HMAC signature verification (`x-n8n-signature` header).
- **Prisma Driver Adapter**: Uses `@prisma/adapter-pg` with `pg` pool instead of the default binary engine.
- **Commit Convention**: `commitlint` enforces lowercase, max-100-char subject lines (e.g., `feat: add medical record crud`).

---

## 2. Accomplishments

### Phase 1: Foundation

- Stabilized Prisma/Neon connection with driver adapter
- Schema finalized: **13 models** (User, Patient, Provider, PatientProvider, ProviderAssignment, WorkingHours, LeaveRequest, Notification, Appointment, Invoice, Payment, MedicalRecord, WorkflowEvent) and **7 enums** (Role, AppointmentStatus, WorkflowEventStatus, LeaveRequestStatus, NotificationStatus, InvoiceStatus, PaymentMethod)
- Migration `add_emr_module` applied for MedicalRecord
- Basic RBAC with RoleGuard component
- User registration/login with bcrypt password hashing
- i18n-ready sidebar navigation

### Phase 2: Scheduling & Patient Management

- **Provider Availability**: `WorkingHours` model per provider (day-of-week schedule) + `LeaveRequest` model with approve/reject workflow
- **Appointment Booking**: Full CRUD with calendar integration, color-coded statuses, rescheduling with auto-notifications
- **Patient Self-Service**: Patients can link/unlink to providers by username, view own appointments, book slots
- **Provider-Patient Linking**: `PatientProvider` join table; providers see only their patients
- **Provider Assignment**: ADMIN assigns providers to RECEPTIONIST users
- **Notification Engine**: Bell icon in header, `getMyUnreadNotifications()`, `markAllAsRead()`, auto-creation on reschedule/link requests
- **Patient Dashboard**: Upcoming/past appointments, doctor list, reschedule alerts
- **Provider Dashboard**: Patient list, appointment management, revenue summary

### Phase 3: Billing Engine

- **Invoice Model**: Per-appointment billing with `totalAmount` (Decimal), `status` (PENDING/PARTIAL/PAID), `dueDate`
- **Payment Model**: Tracks payments against invoices with `paymentMethod` (CASH/CARD/INSURANCE)
- **Billing Server Actions**: `generateInvoiceForAppointment`, `addPayment` (auto-recalculates invoice status), `getPatientInvoices`, `getInvoiceByAppointment`, `listInvoices`, `getProviderFinancials`
- **Receptionist UI**: Invoice table, payment modal, calendar bill indicator
- **Provider Revenue View**: Aggregated financial summary per provider
- **Patient Invoice History**: Patients can view their own invoices and payment statuses

### Phase 4: EMR, Analytics & Seeding

- **EMR Module**: `MedicalRecord` model (diagnosis, prescription, notes) per appointment, upsert behavior, clinical notes button in BookingModal for PROVIDER/ADMIN roles
- **Analytics Dashboard**: `AdminDashboard` component with recharts — BarChart (monthly revenue), PieChart (appointment status distribution), provider workload table. ADMIN-only access via `src/server/actions/analytics.ts`
- **Production Seeding**: `prisma/seed.ts` creates 1 admin, 2 receptionists, 3 providers, 18 patients, 27 appointments, invoices with payments, medical records, working hours, and leave requests. All users login with `Clinic@123`. Cleans existing data before seeding.

### Phase 5: Integration Fixes & Authentication Debugging

- **n8n Workflow SQL Fix**: Corrected the `WhatsApp Booking Agent` workflow JSON (`C:\Users\yazan\OneDrive\Desktop\n8nflow\WhatsApp Booking Agent.json`) to query the actual Prisma-mapped tables (`"appointments"`, `"patients"`, `"users"`) with proper quoted identifiers. The `book_appointment` INSERT now looks up `patient_id` via phone subquery and builds `startTime` from concatenated date+time. Both PostgresTool nodes are documented with SSL-required credential setup for Neon.
- **Neon Password Expiry — Login Fix**: Diagnosed and resolved a silent NextAuth login failure ("Invalid email or password") caused by an expired Neon database password. The `authorize` function could not connect to the database, returning `null` — indistinguishable from a wrong password. Updated `DATABASE_URL` and `DIRECT_DATABASE_URL` in `.env` with a fresh password from the Neon Console. Documented in `docs/KNOWN_ISSUES.md`.

### Git History (key commits)

```
e2d7aa0 docs: log Neon db password expiration issue
e418a4e feat: production seeding with 18 patients, 3 providers, appointments, invoices...
313ac53 feat: analytics dashboard with recharts - revenue bar, status pie, provider workload
fdc26b6 feat: add emr module schema, actions, and clinical notes ui
04ea501 feat(phase3): provider revenue summary + patient invoice history
aae3e4c feat(phase3): billing UI - sidebar, invoice table, payment modal, calendar integration
c7e31b7 feat(phase3): financial module schema + billing server actions
cfd1661 feat: notification engine + header bell + leave auto-notify + i18n sweep
e7a3d54 feat: patient self-service booking + RoleGuard component
6f17d04 feat: patient self-serve provider linking by username with unlink
4f07f4b feat: add patient dashboard with doctors list, upcoming/past appointments...
```

---

## 3. Current State & Pending Work

### State: All Phase 1–5 features are implemented, build-passing, seeded, and pushed to `main`.

### Next Immediate Tasks (resume here)

1. **Update Vercel Environment Variables**: Deploy the database fix by updating `DATABASE_URL` and `DIRECT_DATABASE_URL` in the Vercel dashboard with the new Neon password. Currently only `.env` (local) has the updated password.
2. **End-to-End n8n WhatsApp Bot Test**: Import the corrected `WhatsApp Booking Agent.json` into n8n, create the Postgres credential with SSL enabled, assign it to both PostgresTool nodes, activate the workflow, and verify a full booking flow end-to-end.
3. **Wire system webhook events**: Connect appointment creation/reminder events in the app to the n8n webhook endpoint (`POST /api/webhooks/n8n`) for automated WhatsApp notifications.

### Other Known Items

- **Shadow database is broken**: Use `prisma db push --accept-data-loss` instead of `prisma migrate dev`. Manual migration SQL files should be created and resolved with `prisma migrate resolve --applied`.
- **No test suite yet**: Vitest is available but no tests have been written.
- **No Docker/container setup**: Running directly with `npm run dev`.

---

## 4. Key Files Reference

| File                                           | Purpose                                   |
| ---------------------------------------------- | ----------------------------------------- |
| `prisma/schema.prisma`                         | Full database schema (13 models, 7 enums) |
| `prisma/seed.ts`                               | Production seed script                    |
| `src/server/actions/clinical.ts`               | Medical record CRUD                       |
| `src/server/actions/analytics.ts`              | Admin analytics aggregation               |
| `src/server/actions/billing.ts`                | Invoice + payment actions                 |
| `src/server/actions/notifications.ts`          | Notification read/unread                  |
| `src/components/auth/role-guard.tsx`           | RBAC wrapper component                    |
| `src/components/dashboard/admin-dashboard.tsx` | Admin charts dashboard                    |
| `src/app/api/webhooks/n8n/route.ts`            | n8n webhook endpoint                      |
| `docs/PHASE_4_FINAL_PLAN.md`                   | Original phase 4 plan with checkboxes     |

---

## 5. Environment Variables Required

```
DATABASE_URL=postgres://...
N8N_WEBHOOK_SECRET=your_hmac_secret
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

---

## 6. Quickstart Commands

```bash
npm run dev          # Start development server
npm run build        # Type-check + production build
npx prisma db push --accept-data-loss   # Sync schema to DB
npx prisma db seed   # Seed with demo data (Clinic@123 for all users)
```

---

_Last updated: 2026-07-22 — All Phase 1–5 work complete. Next: Vercel env sync, n8n e2e test._
