# Massive System Upgrade — Execution Plan

> **DO NOT write any code.** This is a planning document only. Each phase outlines what to build, which rules to follow, and how to test.

---

## Rules Reference Index

| Shorthand                                               | Full Path                                               | When to Read                                     |
| ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `RULES/postgresql.mdc`                                  | `rules/postgresql.mdc`                                  | Schema changes, migrations, DB queries           |
| `RULES/nextjs.mdc`                                      | `rules/nextjs.mdc`                                      | Server Components, App Router, API routes, Forms |
| `RULES/typescript.mdc`                                  | `rules/typescript.mdc`                                  | Type safety, naming, function signatures         |
| `RULES/react.mdc`                                       | `rules/react.mdc`                                       | Component structure, hooks, state management     |
| `RULES/clean-code.mdc`                                  | `rules/clean-code.mdc`                                  | Naming, SRP, DRY, encapsulation                  |
| `RULES/anti-overengineering.mdc`                        | `rules/anti-overengineering.mdc`                        | Scope control, simplest solution                 |
| `RULES/ai-agent-specialist.mdc`                         | `rules/ai-agent-specialist.mdc`                         | AI agent architecture, error handling            |
| `RULES/nextjs-app-router-cursorrules-prompt-file.mdc`   | `rules/nextjs-app-router-cursorrules-prompt-file.mdc`   | Route structure, file conventions                |
| `RULES/database.mdc`                                    | `rules/database.mdc`                                    | General DB patterns                              |
| `RULES/vitest-unit-testing-cursorrules-prompt-file.mdc` | `rules/vitest-unit-testing-cursorrules-prompt-file.mdc` | Unit testing patterns                            |

---

## Phase 1: Database Integrity & Phone Numbers

> **Goal**: Enforce phone uniqueness across User/Patient, backfill legacy accounts with placeholder phone `0799101173`.

### Checklist

- [ ] **1.1** Read `RULES/postgresql.mdc` before any schema work. Understand: TIMESTAMPTZ, FK with ON DELETE, NOT NULL by default, no schema changes during peak traffic.

- [ ] **1.2** Read `RULES/typescript.mdc` for type naming conventions (PascalCase for types, camelCase for variables).

- [ ] **1.3** Read `RULES/nextjs-app-router-cursorrules-prompt-file.mdc` for file conventions.

- [ ] **1.4** Read `RULES/clean-code.mdc` for naming and SRP.

- [ ] **1.5** **Schema Change — Add unique constraint to User.email (already exists) and Patient.phone**:
  - `prisma/schema.prisma`: Add `@unique` to `Patient.phone` field
  - Verify `User.email` already has `@unique` (it does)
  - No new column needed — the phone column already exists on Patient

- [ ] **1.6** **Schema Change — Make Patient.phone required for new records**:
  - Change `phone String?` to `phone String` on Patient model (remove nullable)
  - This is a breaking change for existing NULL phone records — must backfill first

- [ ] **1.7** **Create Prisma migration script** (`prisma/migrations/YYYYMMDD_phone_integrity/migration.sql`):
  - Step 1: UPDATE patients SET phone = '0799101173' WHERE phone IS NULL
  - Step 2: ALTER TABLE patients ALTER COLUMN phone SET NOT NULL
  - Step 3: ALTER TABLE patients ADD CONSTRAINT patients_phone_unique UNIQUE (phone)
  - Follow `RULES/postgresql.mdc`: Versioned file, explicit BEGIN/COMMIT, test rollback

- [ ] **1.8** **Update seed script** (`prisma/seed.ts`):
  - Ensure all seed patients have unique phone numbers
  - Add phone field to any User creation that links to Patient
  - Follow `RULES/clean-code.mdc`: DRY, reuse existing patterns

- [ ] **1.9** **Update server actions** that create Patient records:
  - `src/server/actions/patients.ts` — Ensure phone is always provided
  - `src/server/actions/booking-requests.ts` — Patient auto-creation already sets phone
  - `src/app/api/test/approve-booking/route.ts` — Same auto-creation logic
  - Follow `RULES/typescript.mdc`: Explicit return types, no `any`

- [ ] **1.10** **Add phone validation**:
  - Create a Zod schema for phone validation (e.g., `z.string().regex(/^\+?[0-9]{7,15}$/)`)
  - Apply in `createPatient`, `approveBookingRequest`, and inbound webhook
  - Follow `RULES/nextjs.mdc`: Use Zod for form validation

- [ ] **1.11** **Update `approveBookingRequest`** in `src/server/actions/booking-requests.ts`:
  - Before creating Patient, check if phone already exists in Patient table
  - If exists, link to existing patient (don't create duplicate)
  - Follow `RULES/clean-code.mdc`: Single Responsibility

- [ ] **1.12** **Update `createPatient`** in `src/server/actions/patients.ts`:
  - Reject creation if phone already exists (check before transaction)
  - Return clear error message: "A patient with this phone number already exists"

### Testing Strategy — Phase 1

| Test                            | Method                                           | Expected Result                     |
| ------------------------------- | ------------------------------------------------ | ----------------------------------- |
| Migration applies cleanly       | `npx prisma db push`                             | No errors, schema synced            |
| Existing NULL phones backfilled | `SELECT phone FROM patients WHERE phone IS NULL` | 0 rows                              |
| Patient.phone is NOT NULL       | `npx prisma db push` then INSERT without phone   | Constraint violation                |
| Patient.phone is unique         | Insert two patients with same phone              | Unique constraint error             |
| Seed script runs                | `npx prisma db seed`                             | No errors, all patients have phones |
| Duplicate phone rejected        | `createPatient` with existing phone              | `{ success: false, error: "..." }`  |
| Booking request auto-creation   | Approve request for unknown phone                | Patient created with valid phone    |
| TypeScript builds               | `npx tsc --noEmit`                               | Zero errors                         |

---

## Phase 2: Receptionist UI — Smart Patient Creation

> **Goal**: When approving a booking request for an unrecognized phone, open the Create Patient modal pre-filled with booking data. Receptionist reviews/edits, then saves patient AND approves request in one flow.

### Checklist

- [ ] **2.1** Read `RULES/react.mdc` before UI work. Understand: functional components, hooks, controlled forms, proper error states, React.memo for expensive components.

- [ ] **2.2** Read `RULES/nextjs.mdc` for App Router patterns, Suspense boundaries, 'use client' directive.

- [ ] **2.3** Read `RULES/typescript.mdc` for prop types (interface over type, Props prefix).

- [ ] **2.4** Read `RULES/clean-code.mdc` for SRP, DRY, naming.

- [ ] **2.5** Read `RULES/anti-overengineering.mdc` for scope control.

- [ ] **2.6** Read `RULES/vitest-unit-testing-cursorrules-prompt-file.mdc` for testing patterns.

- [ ] **2.7** **Create Patient creation modal** (`src/components/patients/create-patient-modal.tsx`):
  - Dialog component with form fields: name, email, phone, dateOfBirth, notes
  - Pre-fill from props (phone, name from BookingRequest)
  - All fields editable by receptionist
  - Zod validation on submit
  - Follow `RULES/react.mdc`: Controlled components, proper form validation, loading/error states
  - Follow `RULES/typescript.mdc`: Interface for props (e.g., `CreatePatientModalProps`)

- [ ] **2.8** **Create server action** (`src/server/actions/patients.ts` — update `createPatient`):
  - Accept optional `bookingRequestId` parameter
  - On success: create Patient, link to BookingRequest, then auto-approve the BookingRequest
  - Return both patientId and appointmentId
  - Follow `RULES/nextjs.mdc`: Server Actions with RBAC
  - Follow `RULES/postgresql.mdc`: Explicit transaction, parameterized

- [ ] **2.9** **Update `handleApprove`** in `src/app/dashboard/receptionist/requests/page.tsx`:
  - Before calling `approveBookingRequest`, check if patient exists for this phone
  - If patient does NOT exist → open CreatePatientModal with pre-filled data
  - If patient EXISTS → proceed with normal approve flow
  - Follow `RULES/react.mdc`: State management for modal open/close

- [ ] **2.10** **Wire modal submit to approve flow**:
  - On modal save success → call `approveBookingRequest` with the new patientId
  - Invalidate `bookingRequests` and `appointments` queries
  - Show success toast
  - Follow `RULES/nextjs.mdc`: Proper error handling for data fetching

- [ ] **2.11** **Add phone validation to modal**:
  - Zod schema: phone must match regex, name required, email optional but validated if provided
  - Show inline validation errors
  - Follow `RULES/nextjs.mdc`: Zod for form validation

- [ ] **2.12** **Handle edge cases**:
  - If phone already exists when trying to create → show error, suggest linking to existing patient
  - If modal is dismissed → return to queue, no state change
  - If network error → show error toast, keep request in queue
  - Follow `RULES/react.mdc`: Error handling, graceful fallbacks

- [ ] **2.13** **Update BookingRequest type** in `requests/page.tsx`:
  - Add `patientId: string | null` to `BookingRequestItem` type
  - Pass to modal for linking
  - Follow `RULES/typescript.mdc`: Explicit types, no `any`

### Testing Strategy — Phase 2

| Test                                     | Method                                   | Expected Result                                        |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Modal opens on approve for unknown phone | Click approve on request with no patient | Modal appears with pre-filled phone/name               |
| Modal pre-fill data                      | Check form fields                        | Phone and name match BookingRequest                    |
| Modal validation — empty name            | Submit with empty name                   | Validation error shown                                 |
| Modal validation — invalid phone         | Submit with "abc"                        | Validation error shown                                 |
| Modal save + approve                     | Fill valid data, submit                  | Patient created, appointment created, request APPROVED |
| Modal dismiss                            | Click cancel/X                           | Modal closes, request stays PENDING                    |
| Existing phone — no duplicate            | Try phone that exists                    | Error: "Patient with this phone already exists"        |
| Normal approve still works               | Click approve for request WITH patient   | Direct approve, no modal                               |
| TypeScript builds                        | `npx tsc --noEmit`                       | Zero errors                                            |
| Unit test — modal renders                | Vitest + React Testing Library           | Modal visible with pre-filled data                     |

---

## Phase 3: Calendar Visibility for Pending Requests

> **Goal**: Show PENDING and AWAITING_PATIENT_REPLY booking requests on the Calendar view as "Tentative" blocks with dashed borders.

### Checklist

- [ ] **3.1** Read `RULES/react.mdc` for component structure, memoization, performance.

- [ ] **3.2** Read `RULES/nextjs.mdc` for data fetching patterns.

- [ ] **3.3** Read `RULES/typescript.mdc` for type safety.

- [ ] **3.4** Read `RULES/clean-code.mdc` for DRY, SRP.

- [ ] **3.5** Read `RULES/anti-overengineering.mdc` for simplest solution.

- [ ] **3.6** **Create server action** (`src/server/actions/booking-requests.ts` — add `getTentativeBookings`):
  - Query BookingRequest where status IN (PENDING, AWAITING_PATIENT_REPLY)
  - Return as array of `{ start, end, title, status, patientPhone, providerId }` objects
  - Follow `RULES/postgresql.mdc`: Parameterized, explicit columns, LIMIT

- [ ] **3.7** **Update calendar data fetching** (`src/app/dashboard/calendar/page.tsx`):
  - Fetch tentative bookings alongside regular appointments
  - Merge into unified event array for calendar rendering
  - Follow `RULES/nextjs.mdc`: Server Components for data fetching where possible

- [ ] **3.8** **Update Month View** (`src/components/calendar/month-view.tsx`):
  - Render tentative bookings as dashed-border blocks
  - Use amber/yellow color for PENDING, blue for AWAITING_PATIENT_REPLY
  - Show patient phone and "Pending" label
  - Click opens booking request detail (not appointment edit)
  - Follow `RULES/react.mdc`: Memoize event rendering

- [ ] **3.9** **Update Week View** (`src/components/calendar/week-view.tsx`):
  - Same dashed-border treatment for tentative slots
  - Show in the correct time slot based on requestedTime
  - Follow `RULES/react.mdc`: Proper key props

- [ ] **3.10** **Update Day View** (`src/components/calendar/day-view.tsx`):
  - Same dashed-border treatment
  - Show full detail on hover (patient name, phone, requested time)
  - Follow `RULES/react.mdc`: Performance — avoid unnecessary re-renders

- [ ] **3.11** **Update BookingModal** (`src/components/calendar/booking-modal.tsx`):
  - When clicking a tentative block, open modal in read-only mode
  - Show "This is a pending booking request" banner
  - Link to `/dashboard/receptionist/requests` for action
  - Follow `RULES/clean-code.mdc`: Single Responsibility

- [ ] **3.12** **Add calendar legend**:
  - Show color legend: Solid = Confirmed, Dashed Amber = Pending, Dashed Blue = Awaiting Reply
  - Follow `RULES/react.mdc`: Accessible UI

### Testing Strategy — Phase 3

| Test                                  | Method                                    | Expected Result                           |
| ------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Tentative bookings appear on calendar | Create PENDING request, view calendar     | Dashed block visible at correct time      |
| Correct color coding                  | Create PENDING and AWAITING_PATIENT_REPLY | Amber and blue blocks respectively        |
| Click tentative block                 | Click dashed block                        | Read-only modal with booking request info |
| Click confirmed appointment           | Click solid block                         | Normal edit modal                         |
| Month view renders                    | Navigate to month view                    | All tentative blocks visible              |
| Week view renders                     | Navigate to week view                     | All tentative blocks visible              |
| Day view renders                      | Navigate to day view                      | All tentative blocks visible              |
| Performance                           | Calendar with 50+ events                  | No lag, memoization working               |
| TypeScript builds                     | `npx tsc --noEmit`                        | Zero errors                               |

---

## Phase 4: Advanced n8n AI Agent Logic

> **Goal**: Upgrade AI agent conversation flow: Greet → Ask doctor → Collect phone/email → Suggest slots → Submit. Add two-way confirmation loop.

### Checklist

- [ ] **4.1** Read `RULES/ai-agent-specialist.mdc` for AI agent architecture, error handling, security.

- [ ] **4.2** Read `RULES/clean-code.mdc` for DRY, naming.

- [ ] **4.3** Read `RULES/anti-overengineering.mdc` for scope control.

- [ ] **4.4** Read `RULES/typescript.mdc` for type safety.

- [ ] **4.5** **Update AI_SYSTEM_RULES.md** (`C:\Users\yazan\OneDrive\Desktop\n8nflow\AI_SYSTEM_RULES.md`):
  - New conversation flow: Greet → Ask which doctor → Collect phone (if not in WhatsApp metadata) & email → Check availability → Suggest top 3 slots → Confirm → Submit
  - Add two-way confirmation rule: After booking submitted, outgoing message asks "Your booking is confirmed for [Time]. Is this suitable or would you like to modify?"
  - Add re-entry rule: If patient replies "modify" to confirmation, AI takes over again to suggest new times
  - Add email collection rule: Ask for email (optional but recommended for reminders)
  - Add doctor selection rule: If patient doesn't know doctor name, list available providers
  - Follow `RULES/ai-agent-specialist.mdc`: Validate all input with Zod, rate limit, no sensitive data logging

- [ ] **4.6** **Update n8n AI Workflow JSON** (`C:\Users\yazan\OneDrive\Desktop\n8nflow\WhatsApp AI Booking Agent.json`):
  - Update system prompt in AI Agent node to reference new AI_SYSTEM_RULES.md
  - Add email field to Submit Booking Tool payload
  - Add providerId/doctorName to Submit Booking Tool payload
  - Follow `RULES/anti-overengineering.mdc`: Minimal payload, reuse existing patterns

- [ ] **4.7** **Create provider list tool** in n8n workflow:
  - New HTTP Request tool: `GET /api/providers/active` — returns list of active providers with names
  - AI uses this when patient says "any doctor" or doesn't know names
  - Follow `RULES/ai-agent-specialist.mdc`: Tool description must be clear

- [ ] **4.8** **Create `/api/providers/active` endpoint** (`src/app/api/providers/active/route.ts`):
  - Public endpoint (no auth) for n8n AI Agent
  - Query: SELECT id, name FROM users WHERE role = 'PROVIDER' JOIN providers ON users.id = providers.userId WHERE providers.isActive = true
  - Return JSON array of `{ id, name, specialty }`
  - Follow `RULES/postgresql.mdc`: Parameterized, explicit columns

- [ ] **4.9** **Update outbound confirmation workflow** (`WhatsApp Booking Confirmed.json`):
  - Outgoing message format: "Your booking is confirmed for [Date] at [Time] with Dr. [Provider]. Is this suitable or would you like to modify?"
  - Include a "reply MODIFY" prompt
  - Follow `RULES/clean-code.mdc`: DRY, reuse message templates

- [ ] **4.10** **Handle "modify" reply in n8n**:
  - When patient replies "modify" to a confirmation message, route back to AI Agent
  - AI Agent picks up context and suggests new available slots
  - Follow `RULES/ai-agent-specialist.mdc`: Session memory for conversation context

- [ ] **4.11** **Update BookingRequest schema** to store email:
  - Add `patientEmail String?` field to BookingRequest model
  - Update inbound webhook to accept email
  - Update `approveBookingRequest` to pass email to Patient creation
  - Follow `RULES/postgresql.mdc`: TIMESTAMPTZ, FK with ON DELETE

- [ ] **4.12** **Update availability slots API** (`src/app/api/availability/slots/route.ts`):
  - Accept optional `providerId` query param (already exists)
  - Return provider name in slot results (already exists)
  - Follow `RULES/nextjs.mdc`: Proper error handling

### Testing Strategy — Phase 4

| Test                              | Method                         | Expected Result                                 |
| --------------------------------- | ------------------------------ | ----------------------------------------------- |
| AI greets and asks for doctor     | Send "Hi" to WhatsApp bot      | Greeting + "Which doctor would you like?"       |
| AI asks for phone if not provided | Send without WhatsApp metadata | "What is your phone number?"                    |
| AI asks for email                 | After phone collected          | "What is your email? (optional)"                |
| AI suggests slots                 | After all details collected    | Top 3 available slots presented                 |
| AI submits booking                | Patient selects slot           | BookingRequest created, confirmation sent       |
| Two-way confirmation              | After approval                 | "Is this suitable or would you like to modify?" |
| Modify re-entry                   | Patient replies "modify"       | AI suggests new slots                           |
| Provider list endpoint            | GET /api/providers/active      | JSON array of active providers                  |
| Email stored in BookingRequest    | Check DB after AI booking      | patientEmail field populated                    |
| TypeScript builds                 | `npx tsc --noEmit`             | Zero errors                                     |

---

## Phase 5: Automated 24-Hour Reminders

> **Goal**: Daily system sends WhatsApp reminders for tomorrow's appointments.

### Checklist

- [ ] **5.1** Read `RULES/nextjs.mdc` for API routes, Route Handlers.

- [ ] **5.2** Read `RULES/postgresql.mdc` for query patterns.

- [ ] **5.3** Read `RULES/typescript.mdc` for type safety.

- [ ] **5.4** Read `RULES/clean-code.mdc` for SRP, DRY.

- [ ] **5.5** Read `RULES/anti-overengineering.mdc` for simplest solution.

- [ ] **5.6** Read `RULES/ai-agent-specialist.mdc` for external service integration patterns.

- [ ] **5.7** **Design reminder architecture** — Two options (decide before implementing):

  **Option A: Next.js Cron Route** (simpler, self-contained):
  - Create `src/app/api/cron/reminders/route.ts`
  - Vercel Cron Job (`vercel.json` → `{ "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }] }`)
  - Hits the route daily at 8am, queries tomorrow's appointments, sends WhatsApp via n8n

  **Option B: Scheduled n8n Workflow** (more flexible):
  - n8n Schedule Trigger runs daily at 8am
  - HTTP Request to `GET /api/appointments/tomorrow` (new endpoint)
  - Loop through appointments, send WhatsApp message for each
  - Follow `RULES/anti-overengineering.mdc`: Option A is simpler if Vercel cron is available

- [ ] **5.8** **Create `/api/appointments/tomorrow` endpoint** (`src/app/api/appointments/tomorrow/route.ts`):
  - Query: SELECT appointments.*, patients.phone, patients.user.name, providers.user.name as providerName
  - WHERE startTime >= now + 1 day AND startTime < now + 2 days
  - AND status NOT IN (CANCELLED, NO_SHOW)
  - Return JSON array
  - Follow `RULES/postgresql.mdc`: Parameterized, explicit columns, LIMIT

- [ ] **5.9** **Create reminder message formatter** (`src/lib/whatsapp/templates.ts`):
  - `formatAppointmentReminder(appointment)` → string
  - Format: "Hello [Name], you have an appointment tomorrow at [Time] with Dr. [Provider]. Please reply CONFIRM to confirm or call us if you need to reschedule."
  - Follow `RULES/clean-code.mdc`: Single Responsibility, DRY

- [ ] **5.10** **Create n8n reminder workflow** (`C:\Users\yazan\OneDrive\Desktop\n8nflow\WhatsApp Appointment Reminder.json`):
  - Webhook Trigger (receives appointment data from Next.js)
  - Format reminder message
  - Send via Meta WhatsApp API
  - Follow `RULES/ai-agent-specialist.mdc`: Error handling for failed sends

- [ ] **5.11** **Create cron trigger route** (if Option A):
  - `src/app/api/cron/reminders/route.ts`
  - Verify cron secret header (Vercel sends `CRON_SECRET`)
  - Fetch tomorrow's appointments
  - For each appointment, POST to n8n reminder webhook
  - Log results to WorkflowEvent
  - Follow `RULES/nextjs.mdc`: Route Handler, proper error handling

- [ ] **5.12** **Update `vercel.json`** with cron schedule:
  - `{ "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }] }`
  - Follow deployment rules

- [ ] **5.13** **Handle CONFIRM reply** (optional enhancement):
  - When patient replies "CONFIRM", update appointment status to CONFIRMED
  - Store in WorkflowEvent for audit trail
  - Follow `RULES/postgresql.mdc`: Transaction for multi-table update

- [ ] **5.14** **Add reminder status tracking**:
  - Add `reminderSent Boolean @default(false)` to Appointment model (or use WorkflowEvent)
  - Prevent duplicate reminders if cron runs twice
  - Follow `RULES/postgresql.mdc`: Check constraints

### Testing Strategy — Phase 5

| Test                            | Method                                       | Expected Result                          |
| ------------------------------- | -------------------------------------------- | ---------------------------------------- |
| Tomorrow's appointments query   | Create appointment for tomorrow, call API    | Returns the appointment                  |
| Past appointments excluded      | Create appointment for yesterday             | Not returned                             |
| Cancelled appointments excluded | Cancel tomorrow's appointment                | Not returned                             |
| Reminder message format         | Unit test `formatAppointmentReminder`        | Correct string with name, time, provider |
| Cron route responds             | `curl /api/cron/reminders` with valid secret | 200 OK, reminders sent                   |
| Cron route rejects unauthorized | `curl` without cron secret                   | 401 Unauthorized                         |
| n8n reminder workflow           | Trigger with test appointment data           | WhatsApp message sent                    |
| No duplicate reminders          | Run cron twice for same appointment          | Only one reminder sent                   |
| TypeScript builds               | `npx tsc --noEmit`                           | Zero errors                              |
| Unit tests pass                 | `npx vitest run`                             | All tests pass                           |

---

## Cross-Cutting Concerns

### For ALL Phases

- [ ] **CC.1** Read `RULES/typescript.mdc` before writing any TypeScript — strict mode, no `any`, explicit return types.
- [ ] **CC.2** Read `RULES/clean-code.mdc` — SRP, DRY, meaningful names, no magic numbers.
- [ ] **CC.3** Read `RULES/anti-overengineering.mdc` — simplest solution first, don't over-abstract.
- [ ] **CC.4** After each phase: `npx tsc --noEmit` (zero errors), `npx prisma db push` (schema synced).
- [ ] **CC.5** After each phase: commit with conventional commit message, push to GitHub.
- [ ] **CC.6** Update `docs/PROJECT_HANDOVER.md` with new phase documentation.
- [ ] **CC.7** Update `docs/WHATSAPP_BOOKING_PLAN.md` with new phase checkboxes.
- [ ] **CC.8** Update `docs/ARCHITECTURE.md` with new flows/diagrams if applicable.

### Git Commit Convention

- Follow `RULES/git-conventional-commit-messages.mdc`: `feat/fix/refactor/test/docs`
- Max 400 lines per PR (from `RULES/ai-agent-specialist.mdc`)
- Max 100 char subject line

---

## Phase Dependency Map

```
Phase 1 (DB Integrity)
    │
    ├──► Phase 2 (Smart Patient Creation) — depends on phone enforcement
    │
    └──► Phase 3 (Calendar Visibility) — independent, can run in parallel with Phase 2

Phase 4 (AI Agent Logic) — independent, can run in parallel with 1-3

Phase 5 (24-Hour Reminders) — depends on Phase 4 for WhatsApp template consistency
```

---

## Estimated Effort

| Phase   | Complexity | Estimated Steps | Key Risk                              |
| ------- | ---------- | --------------- | ------------------------------------- |
| Phase 1 | Medium     | 12 steps        | Migration backfill on production data |
| Phase 2 | High       | 13 steps        | Modal + server action integration     |
| Phase 3 | Medium     | 12 steps        | Calendar rendering performance        |
| Phase 4 | High       | 12 steps        | n8n AI conversation flow complexity   |
| Phase 5 | Medium     | 14 steps        | Cron scheduling + WhatsApp delivery   |

---

_Plan generated. Awaiting your approval to begin Phase 1._
