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

## Phase 1: Database Schema

> **Rule**: `rules/postgresql.mdc` — TIMESTAMPTZ for all timestamps, FK with ON DELETE, index every FK, NOT NULL by default.

- [ ] 1.1 Add `BookingRequestStatus` enum to `prisma/schema.prisma` (PENDING, APPROVED, REJECTED, CANCELLED)
- [ ] 1.2 Add `BookingRequest` model with fields: id, patientPhone, patientName, requestedDate (TIMESTAMPTZ), requestedTime, durationMinutes, message, status, rejectionReason, modifiedStart, modifiedEnd, providerId (FK → Provider, onDelete: Cascade), patientId (FK → Patient, onDelete: SetNull, nullable), appointmentId (FK → Appointment, onDelete: SetNull, nullable, unique), createdAt, updatedAt
- [ ] 1.3 Add indexes: @@index([status]), @@index([providerId]), @@index([patientPhone])
- [ ] 1.4 Add @@map("booking_requests") table mapping
- [ ] 1.5 Run `npx prisma db push --accept-data-loss` to sync schema
- [ ] 1.6 Run `npx prisma generate` to regenerate client

## Phase 2: Server Actions

> **Rule**: `rules/nextjs.mdc` — Server Actions enforce RBAC via `auth()`. `rules/typescript.mdc` — Explicit return types, async/await. `rules/clean-code.mdc` — Single Responsibility.

- [ ] 2.1 Create `src/server/actions/booking-requests.ts` with `"use server"` directive
- [ ] 2.2 Implement `getBookingRequests(status?: BookingRequestStatus)` — returns queue with provider and patient user info, ordered by createdAt desc
- [ ] 2.3 Implement `approveBookingRequest(id: string)` — validates status is PENDING, creates Appointment at requested time (or modified time), links appointmentId, sets status to APPROVED, triggers outbound `whatsapp-booking-confirmed` workflow
- [ ] 2.4 Implement `rejectBookingRequest(id: string, reason?: string)` — validates status is PENDING, sets status to REJECTED, stores rejectionReason, triggers outbound `whatsapp-booking-rejected` workflow
- [ ] 2.5 Implement `modifyBookingRequest(id: string, newStart: string, newEnd: string)` — validates status is PENDING, stores modifiedStart/modifiedEnd, triggers outbound `whatsapp-booking-modified` workflow
- [ ] 2.6 All actions check `auth()` and verify role is RECEPTIONIST or ADMIN
- [ ] 2.7 All actions use Zod validation for inputs

## Phase 3: Inbound Webhook

> **Rule**: `rules/nextjs.mdc` — Route Handlers for API routes. `rules/postgresql.mdc` — Parameterized queries, no string interpolation.

- [ ] 3.1 Create `src/app/api/webhooks/n8n/requests/route.ts`
- [ ] 3.2 Implement HMAC signature verification (reuse pattern from existing `/api/webhooks/n8n/route.ts`)
- [ ] 3.3 Parse JSON body: workflowType, idempotencyKey, patientPhone, patientName, requestedDate, requestedTime, durationMinutes, message, providerId
- [ ] 3.4 Check idempotency via WorkflowEvent (skip if key exists)
- [ ] 3.5 Lookup patient by phone number in `patients` table → link patientId if found
- [ ] 3.6 If providerId not provided, use first active provider as default
- [ ] 3.7 Create `BookingRequest` record with status PENDING
- [ ] 3.8 Create Notification for all RECEPTIONIST + ADMIN users: type `booking_request`, message "New WhatsApp booking request from [phone] for [date] at [time]"
- [ ] 3.9 Log WorkflowEvent for audit trail
- [ ] 3.10 Return 201 Created with booking request ID

## Phase 4: Outbound Webhooks

> **Rule**: `rules/clean-code.mdc` — DRY, reuse existing `triggerN8nWorkflow` utility.

- [ ] 4.1 In `approveBookingRequest`: call `triggerN8nWorkflow("whatsapp-booking-confirmed", { patientPhone, date, time, providerName, appointmentId })`
- [ ] 4.2 In `rejectBookingRequest`: call `triggerN8nWorkflow("whatsapp-booking-rejected", { patientPhone, date, reason })`
- [ ] 4.3 In `modifyBookingRequest`: call `triggerN8nWorkflow("whatsapp-booking-modified", { patientPhone, originalDate, newDate, newTime, providerName })`
- [ ] 4.4 Wrap each trigger in `.catch(() => {})` to prevent outbound failures from blocking the DB update

## Phase 5: Receptionist UI — Request Management

> **Rule**: `rules/nextjs.mdc` — Client components with `'use client'`, Suspense boundaries. `rules/react.mdc` — Functional components, hooks, memoization. `rules/anti-overengineering.mdc` — Mirror existing Rescheduling page pattern.

- [ ] 5.1 Create `src/app/dashboard/receptionist/requests/page.tsx`
- [ ] 5.2 Wrap in `<Suspense>` boundary (same pattern as reschedule page)
- [ ] 5.3 **Left Panel — Queue**: Fetch PENDING BookingRequests, display as clickable cards with patient phone, requested date/time, provider name, timestamp
- [ ] 5.4 **Right Panel — Actions**: Show request details when selected, with three action buttons: Approve, Reject, Modify
- [ ] 5.5 **Approve flow**: Calls `approveBookingRequest`, invalidates query, shows toast, removes from queue
- [ ] 5.6 **Reject flow**: Opens optional reason input, calls `rejectBookingRequest`, shows toast, removes from queue
- [ ] 5.7 **Modify flow**: Shows available slot suggestions (reuse `getSuggestedSlots` logic), receptionist picks new time, calls `modifyBookingRequest`, shows toast
- [ ] 5.8 Loading state with Skeleton components
- [ ] 5.9 Empty state with CheckCircle icon and "No pending requests" message

## Phase 6: Navigation & i18n

> **Rule**: `rules/nextjs.mdc` — i18n-ready navigation. `rules/clean-code.mdc` — DRY, reuse existing sidebar pattern.

- [ ] 6.1 Add "Requests" nav item to `src/components/dashboard/sidebar.tsx` for RECEPTIONIST + ADMIN roles with `MessageSquare` icon
- [ ] 6.2 Add `nav.requests` translation: EN "Requests", AR "طلبات الحجز" to `src/lib/i18n/translations.ts`

## Phase 7: Notification Deep-Linking

> **Rule**: `rules/react.mdc` — State management, `rules/nextjs.mdc` — Client-side navigation.

- [ ] 7.1 Update `src/components/notifications/notification-bell.tsx` to handle `booking_request` notification type
- [ ] 7.2 On click of `booking_request` notification → route to `/dashboard/receptionist/requests`
- [ ] 7.3 Ensure notification bell visibility includes RECEPTIONIST role (already done)

## Phase 8: n8n Workflow Updates

> **Rule**: `rules/anti-overengineering.mdc` — Match existing workflow patterns, keep payloads minimal.

- [ ] 8.1 Update `WhatsApp Booking Agent.json` — Inbound workflow: Meta Webhook → Parse message → HTTP Request to `/api/webhooks/n8n/requests` with HMAC signature
- [ ] 8.2 Create `WhatsApp Booking Confirmed.json` — Outbound: Webhook receives from Next.js → Format confirmation message → Send via Meta WhatsApp API
- [ ] 8.3 Create `WhatsApp Booking Rejected.json` — Outbound: Webhook receives from Next.js → Format rejection message → Send via Meta WhatsApp API
- [ ] 8.4 Create `WhatsApp Booking Modified.json` — Outbound: Webhook receives from Next.js → Format modification message → Send via Meta WhatsApp API
- [ ] 8.5 Save all JSON files to `C:\Users\yazan\OneDrive\Desktop\n8nflow\`

## Phase 9: Verification

- [ ] 9.1 Run `npx tsc --noEmit` — zero errors
- [ ] 9.2 Run `npm run build` — passes
- [ ] 9.3 Verify DB sync with `npx prisma db push`
- [ ] 9.4 Commit all changes with conventional commit message
- [ ] 9.5 Push to GitHub
- [ ] 9.6 Update `docs/PROJECT_HANDOVER.md` with Phase 7 documentation

---

_Last updated: 2026-07-25 — Plan created, awaiting implementation._
