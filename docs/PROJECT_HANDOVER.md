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
- Schema finalized: **14 models** (User, Patient, Provider, PatientProvider, ProviderAssignment, WorkingHours, LeaveRequest, Notification, Appointment, Invoice, Payment, MedicalRecord, WorkflowEvent, BookingRequest) and **9 enums** (Role, AppointmentStatus, WorkflowEventStatus, LeaveRequestStatus, NotificationStatus, InvoiceStatus, PaymentMethod, BookingRequestStatus)
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

### Phase 6: Calendar UX, Smart Rescheduling Workflow & Notification Deep-Linking

- **Calendar Default View — Month**: Changed default calendar view from `"week"` to `"month"` across all dashboards. Added `"day"` as a third view option with full 14-hour grid (7am–8pm). `CalendarView` now accepts `defaultView` and `defaultDate` props for deep linking.
- **Day View Component**: New `src/components/calendar/day-view.tsx` — hourly grid with appointment cards, click-to-book on empty slots, click-to-edit on appointments.
- **Provider "Request Rescheduling" Feature**: Provider dashboard calendar page has a "Request Rescheduling" button. Dialog with date picker flags all active appointments for that date as `NEEDS_RESCHEDULE` instead of cancelling them. Creates `reschedule_request` notifications for RECEPTIONIST + ADMIN users.
- **Schema — `NEEDS_RESCHEDULE` Enum Value**: Added to `AppointmentStatus` in Prisma schema. Database synced via `prisma db push --accept-data-loss`. Status color (orange) added to month-view, week-view, day-view, and booking-modal.
- **Smart Rescheduling Dashboard**: New page at `/dashboard/receptionist/reschedule?date=YYYY-MM-DD&providerId=XYZ`. Two-panel split-screen layout:
  - **Left Panel (Queue)**: Lists all `NEEDS_RESCHEDULE` appointments for the provider+date. Shows patient name, time, duration badge. Selected appointment highlighted.
  - **Right Panel (Smart Rescheduler)**: Idle until appointment selected. Fetches dynamic availability for that provider and appointment duration. Shows up to 5 suggested slots as quick-action buttons. Mini monthly calendar below for manual date picking.
- **Reschedule Server Actions**: `getRescheduleQueue`, `getSuggestedSlots` (scans working hours, existing appointments, leave requests over 14 days), `rescheduleAppointment` (validates overlap, moves slot, sets status back to `SCHEDULED`).
- **Notification Deep-Linking**: Clicking a `reschedule_request` notification routes to `/dashboard/receptionist/reschedule?date=...&providerId=...`. Notification bell now also visible for ADMIN role.
- **Sidebar Navigation**: Added "Reschedule" nav item for RECEPTIONIST + ADMIN roles with `CalendarClock` icon. i18n translations added (EN: "Reschedule", AR: "إعادة جدولة").
- **Vercel Build Fix**: Wrapped `useSearchParams()` in `<Suspense>` boundaries on both calendar and reschedule pages to fix Next.js static generation bailout.

### Phase 7: Two-Way WhatsApp Booking Request Workflow

- **Schema — `BookingRequest` Model**: New model with `BookingRequestStatus` enum (PENDING, APPROVED, REJECTED, CANCELLED, AWAITING_PATIENT_REPLY). Fields: patientPhone, patientName, requestedDate, requestedTime, durationMinutes, message, status, rejectionReason, modifiedStart/End. Relations to Provider, Patient (nullable), Appointment (nullable). 9 enums total.
- **Inbound Webhook**: `POST /api/webhooks/n8n/requests` — receives parsed WhatsApp messages from n8n, creates BookingRequest, looks up patient by phone, creates Notification for RECEPTIONIST + ADMIN, logs WorkflowEvent for idempotency.
- **Server Actions**: `getBookingRequests(status)`, `approveBookingRequest(id)` (overlap check, creates Appointment, triggers outbound confirmation), `rejectBookingRequest(id, reason)` (triggers outbound rejection), `modifyBookingRequest(id, newStart, newEnd)` (overlap check, sets AWAITING_PATIENT_REPLY, triggers outbound modification).
- **Receptionist UI**: Two-panel layout at `/dashboard/receptionist/requests`. Left panel: queue of PENDING requests with phone, date/time, provider, "Modified" badge. Right panel: request details + Approve/Reject/Modify actions. Modify shows smart slot suggestions (reuses `getSuggestedSlots`). Error toasts on all failures.
- **Notification Deep-Linking**: `booking_request` notifications route to `/dashboard/receptionist/requests`.
- **Sidebar Navigation**: Added "Requests" nav item for RECEPTIONIST + ADMIN with `MessageSquare` icon. i18n: EN "Requests", AR "طلبات الحجز".
- **n8n Workflows**: Updated `WhatsApp Booking Agent.json` (inbound: Meta Webhook → Parse → Forward to Next.js API → Send acknowledgement). Created 3 outbound workflows: `WhatsApp Booking Confirmed.json`, `WhatsApp Booking Rejected.json`, `WhatsApp Booking Modified.json` (Webhook → Format message → Send via Meta WhatsApp API).
- **Execution Plan**: Full plan documented in `docs/WHATSAPP_BOOKING_PLAN.md` with checkboxes mapped to rule files.

### Phase 8: Mock Testing Environment

- **MOCK_WEBHOOK_MODE**: Added `MOCK_WEBHOOK_MODE=true` env var support — bypasses HMAC verification on inbound webhook and enables test API routes at `/api/test/*`.
- **CLI Test Script**: `scripts/test-booking.js` — supports `--phone`, `--date`, `--time`, `--approve <id>`, `--reject <id> --reason`, `--modify <id> --new-start --new-end`, `--list` flags. Sends requests directly to Next.js API, bypassing n8n.
- **Test API Routes**: `/api/test/approve-booking`, `/api/test/reject-booking`, `/api/test/list-bookings` — no auth required, mock mode only.
- **Documentation**: `docs/MOCK_TESTING_GUIDE.md` with full testing workflow.

### Phase 9: Bug Fixes & Polish

- **Overlap Detection**: Both `approveBookingRequest` and `modifyBookingRequest` now query existing non-cancelled appointments for the same provider+time window before creating/modifying. Returns 409 error if overlap found.
- **Zod Datetime Fix**: Changed `z.string().datetime()` to `z.coerce.date()` in `modifySchema` for graceful parsing of ISO strings without timezone.
- **Suggested Slots Fix**: `getSuggestedSlots` now returns `slotStartDT.toISOString()` / `slotEndDT.toISOString()` (proper ISO 8601 with timezone) instead of bare datetime strings.
- **Cache Invalidation**: Added `revalidatePath("/dashboard/receptionist/requests")` to all three server actions (approve, reject, modify).
- **Client Error Handling**: Added `catch` blocks to all three action handlers for proper toast error display on network/exceptions.
- **Patient Auto-Creation**: `approveBookingRequest` auto-creates Patient+User records by phone number when no linked patient exists.

### Phase 10: n8n AI Agent Workflow

- **AI System Rules**: Created `C:\Users\yazan\OneDrive\Desktop\n8nflow\AI_SYSTEM_RULES.md` — System prompt for AI Agent (no medical advice, strict tone, conversation flow rules, tool usage rules, privacy compliance).
- **AI Workflow JSON**: Created `C:\Users\yazan\OneDrive\Desktop\n8nflow\WhatsApp AI Booking Agent.json` — Full n8n workflow with: Webhook Trigger, Parse Message, AI Agent (Conversational Agent), Window Buffer Memory, Check Availability Tool (HTTP Request → `/api/availability/slots`), Submit Booking Tool (HTTP Request → `/api/webhooks/n8n/requests`).
- **Availability API**: Created `/api/availability/slots` route — Public endpoint for n8n AI Agent to query available appointment slots (no auth required). Scans working hours, existing appointments, leave requests over 7 days.

### Git History (key commits)

```
d074475 feat: public availability slots API endpoint for n8n AI agent
520e4d8 fix: AWAITING_PATIENT_REPLY status, error toasts, queue cleanup for booking requests
a505604 fix: overlap checks, datetime validation, revalidatePath, UI polish for booking requests
2f1b956 feat: implement two-way WhatsApp booking request workflow with n8n integration
82905c8 fix: wrap useSearchParams in Suspense boundary to fix Vercel build
089c2aa feat: implement smart rescheduling workflow with two-panel UI and smart suggestions
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

### State: All Phase 1–10 features are implemented, build-passing, seeded, and pushed to `main`.

### Next Immediate Tasks (resume here)

1. **Update Vercel Environment Variables**: Deploy the database fix by updating `DATABASE_URL` and `DIRECT_DATABASE_URL` in the Vercel dashboard with the new Neon password. Currently only `.env` (local) has the updated password.
2. **Import n8n AI Agent Workflow**: Import `C:\Users\yazan\OneDrive\Desktop\n8nflow\WhatsApp AI Booking Agent.json` into n8n. Set `NEXTJS_URL` env var in n8n to your Next.js app URL. Copy `AI_SYSTEM_RULES.md` contents into `AI_SYSTEM_PROMPT` env var.
3. **End-to-End WhatsApp Bot Test**: Activate the n8n AI workflow, send a WhatsApp message to the bot, verify the full conversational booking flow (greeting → collect details → check availability → submit booking → confirmation).
4. **Wire system webhook events**: Connect appointment creation/reminder events in the app to the n8n webhook endpoint (`POST /api/webhooks/n8n`) for automated WhatsApp notifications.

### Other Known Items

- **Shadow database is broken**: Use `prisma db push --accept-data-loss` instead of `prisma migrate dev`. Manual migration SQL files should be created and resolved with `prisma migrate resolve --applied`.
- **No test suite yet**: Vitest is available but no tests have been written.
- **No Docker/container setup**: Running directly with `npm run dev`.

---

## 4. Key Files Reference

| File                                                 | Purpose                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `prisma/schema.prisma`                               | Full database schema (14 models, 10 enums)                  |
| `prisma/seed.ts`                                     | Production seed script                                      |
| `src/server/actions/appointments.ts`                 | Appointment CRUD + rescheduling workflow                    |
| `src/server/actions/booking-requests.ts`             | WhatsApp booking request CRUD + overlap checks + n8n triggers |
| `src/server/actions/clinical.ts`                     | Medical record CRUD                                         |
| `src/server/actions/analytics.ts`                    | Admin analytics aggregation                                 |
| `src/server/actions/billing.ts`                      | Invoice + payment actions                                   |
| `src/server/actions/notifications.ts`                | Notification read/unread                                    |
| `src/server/actions/n8n.ts`                          | n8n workflow trigger helper                                 |
| `src/components/auth/role-guard.tsx`                 | RBAC wrapper component                                      |
| `src/components/dashboard/admin-dashboard.tsx`       | Admin charts dashboard                                      |
| `src/components/dashboard/sidebar.tsx`               | Sidebar navigation with role-based items                    |
| `src/components/calendar/calendar-view.tsx`          | Calendar root — month/week/day toggle                       |
| `src/components/calendar/day-view.tsx`               | Day view — hourly grid with appointments                    |
| `src/components/calendar/month-view.tsx`             | Month view with status dots                                 |
| `src/components/calendar/week-view.tsx`              | Week view with time slots                                   |
| `src/components/calendar/booking-modal.tsx`          | Appointment create/edit/cancel modal                        |
| `src/components/notifications/notification-bell.tsx` | Notification dropdown with deep-linking                     |
| `src/components/ui/badge.tsx`                        | Badge component for status/duration tags                    |
| `src/app/dashboard/calendar/page.tsx`                | Calendar page — role-based filtering + Request Rescheduling |
| `src/app/dashboard/receptionist/reschedule/page.tsx` | Smart rescheduling dashboard (two-panel)                    |
| `src/app/dashboard/receptionist/requests/page.tsx`   | WhatsApp booking requests dashboard (two-panel)             |
| `src/app/api/webhooks/n8n/requests/route.ts`         | Inbound webhook for WhatsApp booking requests               |
| `src/app/api/webhooks/n8n/route.ts`                  | n8n webhook endpoint                                        |
| `src/app/api/availability/slots/route.ts`            | Public availability slots API for n8n AI Agent              |
| `src/app/api/test/approve-booking/route.ts`          | Test-only approve endpoint (mock mode)                      |
| `src/app/api/test/reject-booking/route.ts`           | Test-only reject endpoint (mock mode)                       |
| `src/app/api/test/list-bookings/route.ts`            | Test-only list endpoint (mock mode)                         |
| `scripts/test-booking.js`                            | CLI test tool for WhatsApp booking flow                     |
| `docs/PROJECT_HANDOVER.md`                           | This file — project context handover                        |
| `docs/WHATSAPP_BOOKING_PLAN.md`                      | WhatsApp booking workflow execution plan                    |
| `docs/ARCHITECTURE.md`                               | System architecture, ERD, flow diagrams                     |
| `docs/MOCK_TESTING_GUIDE.md`                         | Mock testing workflow documentation                         |
| `C:\...\n8nflow\AI_SYSTEM_RULES.md`                  | AI Agent system prompt for n8n                              |
| `C:\...\n8nflow\WhatsApp AI Booking Agent.json`      | n8n AI Agent workflow JSON (import into n8n)                |

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

_Last updated: 2026-07-26 — All Phase 1–10 work complete including AI Agent workflow. Next: Vercel env sync, n8n import, e2e test._
