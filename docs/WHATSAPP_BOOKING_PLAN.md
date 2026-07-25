# WhatsApp Two-Way Booking Request Workflow — Execution Plan

> **AI AGENT INSTRUCTIONS**: Follow this plan sequentially. Each checkbox maps to a rule file in `rules/`. Read the referenced rule before implementing that section.

---

## Rules Reference

| Rule File                                             | Applies To                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `rules/nextjs.mdc`                                    | Server Components, App Router, Data Fetching, Forms, Validation |
| `rules/nextjs-app-router-cursorrules-prompt-file.mdc` | Route structure, special files, file conventions                |
| `rules/postgresql.mdc`                                | Schema design, TIMESTAMPTZ, FK constraints, indexing            |
| `rules/typescript.mdc`                                | Type safety, naming conventions, function signatures            |
| `rules/react.mdc`                                     | Component structure, hooks, state management, performance       |
| `rules/clean-code.mdc`                                | Naming, single responsibility, DRY, encapsulation               |
| `rules/anti-overengineering.mdc`                      | Scope control, simplest solution first                          |

---

## Booking Request State Machine

```
                    ┌──────────────┐
                    │   (incoming) │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │    PENDING   │◄───── (initial state)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌────────────┐ ┌──────────┐ ┌──────────────────┐
       │  APPROVED  │ │ REJECTED │ │  AWAITING_PATIENT │
       │(+appt created)│ │(+reason) │ │    _REPLY        │
       └────────────┘ └──────────┘ └──────────────────┘
                                        (after modify)
                                              │
                                              ▼
                                    Patient confirms → back to PENDING
                                    Patient declines  → REJECTED
```

**Overlap Check**: Both `approveBookingRequest` and `modifyBookingRequest` query existing non-cancelled appointments for the same provider+time window before creating/modifying. Returns error if overlap detected.

---

## Phase 1: Database Schema

> **Rule**: `rules/postgresql.mdc` — TIMESTAMPTZ for all timestamps, FK with ON DELETE, index every FK, NOT NULL by default.

- [x] 1.1 Add `BookingRequestStatus` enum to `prisma/schema.prisma` (PENDING, APPROVED, REJECTED, CANCELLED, AWAITING_PATIENT_REPLY)
- [x] 1.2 Add `BookingRequest` model with fields: id, patientPhone, patientName, requestedDate (TIMESTAMPTZ), requestedTime, durationMinutes, message, status, rejectionReason, modifiedStart, modifiedEnd, providerId (FK → Provider, onDelete: Cascade), patientId (FK → Patient, onDelete: SetNull, nullable), appointmentId (FK → Appointment, onDelete: SetNull, nullable, unique), createdAt, updatedAt
- [x] 1.3 Add indexes: @@index([status]), @@index([providerId]), @@index([patientPhone])
- [x] 1.4 Add @@map("booking_requests") table mapping
- [x] 1.5 Run `npx prisma db push --accept-data-loss` to sync schema
- [x] 1.6 Run `npx prisma generate` to regenerate client

## Phase 2: Server Actions

> **Rule**: `rules/nextjs.mdc` — Server Actions enforce RBAC via `auth()`. `rules/typescript.mdc` — Explicit return types, async/await. `rules/clean-code.mdc` — Single Responsibility.

- [x] 2.1 Create `src/server/actions/booking-requests.ts` with `"use server"` directive
- [x] 2.2 Implement `getBookingRequests(status?: BookingRequestStatus)` — returns queue with provider and patient user info, ordered by createdAt desc
- [x] 2.3 Implement `approveBookingRequest(id: string)` — validates status is PENDING, **checks for overlapping appointments**, creates Appointment at requested time (or modified time), links appointmentId, sets status to APPROVED, triggers outbound `whatsapp-booking-confirmed` workflow
- [x] 2.4 Implement `rejectBookingRequest(id: string, reason?: string)` — validates status is PENDING, sets status to REJECTED, stores rejectionReason, triggers outbound `whatsapp-booking-rejected` workflow
- [x] 2.5 Implement `modifyBookingRequest(id: string, newStart: string, newEnd: string)` — validates status is PENDING, **checks for overlapping appointments on the new time**, stores modifiedStart/modifiedEnd, **sets status to AWAITING_PATIENT_REPLY**, triggers outbound `whatsapp-booking-modified` workflow
- [x] 2.6 All actions check `auth()` and verify role is RECEPTIONIST or ADMIN
- [x] 2.7 All actions use Zod validation for inputs (`z.coerce.date()` for datetime fields)
- [x] 2.8 All actions call `revalidatePath("/dashboard/receptionist/requests")` on success

## Phase 3: Inbound Webhook

> **Rule**: `rules/nextjs.mdc` — Route Handlers for API routes. `rules/postgresql.mdc` — Parameterized queries, no string interpolation.

- [x] 3.1 Create `src/app/api/webhooks/n8n/requests/route.ts`
- [x] 3.2 Implement HMAC signature verification (reuse pattern from existing `/api/webhooks/n8n/route.ts`)
- [x] 3.3 Parse JSON body: workflowType, idempotencyKey, patientPhone, patientName, requestedDate, requestedTime, durationMinutes, message, providerId
- [x] 3.4 Check idempotency via WorkflowEvent (skip if key exists)
- [x] 3.5 Lookup patient by phone number in `patients` table → link patientId if found
- [x] 3.6 If providerId not provided, use first active provider as default
- [x] 3.7 Create `BookingRequest` record with status PENDING
- [x] 3.8 Create Notification for all RECEPTIONIST + ADMIN users: type `booking_request`, message "New WhatsApp booking request from [phone] for [date] at [time]"
- [x] 3.9 Log WorkflowEvent for audit trail
- [x] 3.10 Return 201 Created with booking request ID
- [x] 3.11 Support `MOCK_WEBHOOK_MODE=true` to bypass HMAC for local testing

## Phase 4: Outbound Webhooks

> **Rule**: `rules/clean-code.mdc` — DRY, reuse existing `triggerN8nWorkflow` utility.

- [x] 4.1 In `approveBookingRequest`: call `triggerN8nWorkflow("whatsapp-booking-confirmed", { patientPhone, date, time, providerName, appointmentId })`
- [x] 4.2 In `rejectBookingRequest`: call `triggerN8nWorkflow("whatsapp-booking-rejected", { patientPhone, date, reason })`
- [x] 4.3 In `modifyBookingRequest`: call `triggerN8nWorkflow("whatsapp-booking-modified", { patientPhone, originalDate, newDate, newTime, providerName })`
- [x] 4.4 Wrap each trigger in `.catch(() => {})` to prevent outbound failures from blocking the DB update

## Phase 5: Receptionist UI — Request Management

> **Rule**: `rules/nextjs.mdc` — Client components with `'use client'`, Suspense boundaries. `rules/react.mdc` — Functional components, hooks, memoization. `rules/anti-overengineering.mdc` — Mirror existing Rescheduling page pattern.

- [x] 5.1 Create `src/app/dashboard/receptionist/requests/page.tsx`
- [x] 5.2 Wrap in `<Suspense>` boundary (same pattern as reschedule page)
- [x] 5.3 **Left Panel — Queue**: Fetch PENDING BookingRequests, display as clickable cards with patient phone, requested date/time, provider name, timestamp. Modified requests show "Modified" badge with new time.
- [x] 5.4 **Right Panel — Actions**: Show request details when selected (including suggested new time if modified), with three action buttons: Approve, Reject, Modify
- [x] 5.5 **Approve flow**: Calls `approveBookingRequest`, invalidates query, shows toast (success/error), removes from queue. Handles overlap errors.
- [x] 5.6 **Reject flow**: Opens optional reason input, calls `rejectBookingRequest`, shows toast, removes from queue
- [x] 5.7 **Modify flow**: Shows available slot suggestions (reuse `getSuggestedSlots` logic), receptionist picks new time, calls `modifyBookingRequest`, shows toast. Request moves to AWAITING_PATIENT_REPLY and disappears from queue.
- [x] 5.8 Loading state with Skeleton components
- [x] 5.9 Empty state with CheckCircle icon and "No pending requests" message
- [x] 5.10 Error handling: try/catch on all handlers, errors shown as red toast notifications

## Phase 6: Navigation & i18n

> **Rule**: `rules/nextjs.mdc` — i18n-ready navigation. `rules/clean-code.mdc` — DRY, reuse existing sidebar pattern.

- [x] 6.1 Add "Requests" nav item to `src/components/dashboard/sidebar.tsx` for RECEPTIONIST + ADMIN roles with `MessageSquare` icon
- [x] 6.2 Add `nav.requests` translation: EN "Requests", AR "طلبات الحجز" to `src/lib/i18n/translations.ts`

## Phase 7: Notification Deep-Linking

> **Rule**: `rules/react.mdc` — State management, `rules/nextjs.mdc` — Client-side navigation.

- [x] 7.1 Update `src/components/notifications/notification-bell.tsx` to handle `booking_request` notification type
- [x] 7.2 On click of `booking_request` notification → route to `/dashboard/receptionist/requests`
- [x] 7.3 Ensure notification bell visibility includes RECEPTIONIST role (already done)

## Phase 8: n8n Workflow Updates

> **Rule**: `rules/anti-overengineering.mdc` — Match existing workflow patterns, keep payloads minimal.

- [x] 8.1 Update `WhatsApp Booking Agent.json` — Inbound workflow: Meta Webhook → Parse message → HTTP Request to `/api/webhooks/n8n/requests` with HMAC signature
- [x] 8.2 Create `WhatsApp Booking Confirmed.json` — Outbound: Webhook receives from Next.js → Format confirmation message → Send via Meta WhatsApp API
- [x] 8.3 Create `WhatsApp Booking Rejected.json` — Outbound: Webhook receives from Next.js → Format rejection message → Send via Meta WhatsApp API
- [x] 8.4 Create `WhatsApp Booking Modified.json` — Outbound: Webhook receives from Next.js → Format modification message → Send via Meta WhatsApp API
- [x] 8.5 Save all JSON files to `C:\Users\yazan\OneDrive\Desktop\n8nflow\`

## Phase 9: Verification

- [x] 9.1 Run `npx tsc --noEmit` — zero errors
- [x] 9.2 Run `npm run build` — passes
- [x] 9.3 Verify DB sync with `npx prisma db push`
- [x] 9.4 Commit all changes with conventional commit message
- [x] 9.5 Push to GitHub
- [x] 9.6 Update `docs/PROJECT_HANDOVER.md` with Phase 7 documentation

## Phase 10: Mock Testing Environment

- [x] 10.1 Add `MOCK_WEBHOOK_MODE=true` env var support — bypasses HMAC verification on inbound webhook
- [x] 10.2 Create `scripts/test-booking.js` CLI tool — supports `--phone`, `--date`, `--time`, `--approve`, `--reject`, `--modify`, `--list` flags
- [x] 10.3 Create `/api/test/approve-booking` route — test-only approve endpoint (no auth, mock mode only)
- [x] 10.4 Create `/api/test/reject-booking` route — test-only reject endpoint
- [x] 10.5 Create `/api/test/list-bookings` route — test-only list endpoint
- [x] 10.6 Document mock testing workflow in `docs/MOCK_TESTING_GUIDE.md`

## Phase 11: Bug Fixes & Polish

- [x] 11.1 Fix overlap detection — `approveBookingRequest` and `modifyBookingRequest` now query existing non-cancelled appointments before creating/modifying. Returns 409 error if overlap found.
- [x] 11.2 Fix Zod datetime validation — Changed `z.string().datetime()` to `z.coerce.date()` in `modifySchema` for graceful parsing
- [x] 11.3 Fix `getSuggestedSlots` — Returns proper ISO strings with timezone (`toISOString()`) instead of bare datetime strings
- [x] 11.4 Fix cache invalidation — Added `revalidatePath("/dashboard/receptionist/requests")` to all three server actions
- [x] 11.5 Fix client error handling — Added `catch` blocks to all three action handlers (approve/reject/modify) for proper toast error display
- [x] 11.6 Fix patient auto-creation — `approveBookingRequest` auto-creates Patient+User records by phone number when no linked patient exists
- [x] 11.7 Add `AWAITING_PATIENT_REPLY` status — Modified requests now set this status, removing them from the PENDING queue

## Phase 12: n8n AI Agent Workflow

- [x] 12.1 Create `C:\Users\yazan\OneDrive\Desktop\n8nflow\AI_SYSTEM_RULES.md` — System prompt for AI Agent (no medical advice, strict tone, conversation flow rules, tool usage rules)
- [x] 12.2 Create `C:\Users\yazan\OneDrive\Desktop\n8nflow\WhatsApp AI Booking Agent.json` — Full n8n workflow with: Webhook Trigger, Parse Message, AI Agent (Conversational Agent), Window Buffer Memory, Check Availability Tool (HTTP Request → `/api/availability/slots`), Submit Booking Tool (HTTP Request → `/api/webhooks/n8n/requests`)
- [x] 12.3 Create `/api/availability/slots` route — Public endpoint for n8n AI Agent to query available appointment slots (no auth required)

---

_Last updated: 2026-07-26 — All phases complete including AI Agent workflow._
