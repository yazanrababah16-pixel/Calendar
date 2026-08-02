# Phase 8: Patient UX Overhaul & Advanced Notifications

**Goal:** Pause server deployment. Refine Patient UX, fix existing UI bugs, and expand the notification system. All changes are scoped to the Patient-facing experience and notification infrastructure.

**Date Created:** August 1, 2026
**Last Updated:** August 2, 2026

---

## Table of Contents

1. [Rule Mapping Summary](#rule-mapping-summary)
2. [Objective 1: Patient UI & Booking Flow Audit](#objective-1-patient-ui--booking-flow-audit)
3. [Objective 2: Dedicated Notifications Page](#objective-2-dedicated-notifications-page)
4. [Objective 3: Doctor Emergency Cancellation Feature](#objective-3-doctor-emergency-cancellation-feature)
5. [Execution Order](#execution-order)
6. [Files Changed Summary](#files-changed-summary)
7. [Testing Checklist](#testing-checklist)

---

## Rule Mapping Summary

Every step in this plan is governed by the following rule files. Each step explicitly cites which rules apply.

| Rule File                         | Key Principles to Follow                                                                                                                                                                                                                                                     | Applies To                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `rules/react.mdc`                 | Functional components, hooks rules (Rules of Hooks), memoization (`useMemo`/`useCallback`), error boundaries, accessibility (semantic HTML + ARIA), controlled components, `useReducer` for complex state                                                                    | All `.tsx` components                                      |
| `rules/nextjs.mdc`                | Server Components by default, `'use client'` only when needed, App Router conventions (loading.js, error.js), Zod validation at boundaries, proper loading/error states, minimize client-side state                                                                          | All `src/app/` routes and `src/server/actions/`            |
| `rules/postgresql.mdc`            | TIMESTAMPTZ for all timestamps, UUID PKs, `NOT NULL` by default, explicit `ON DELETE` FK behavior, parameterized queries via Prisma (never string interpolation), explicit column selection (never `SELECT *`), `LIMIT` on result sets, index every FK, versioned migrations | `prisma/schema.prisma`, migration files, raw queries       |
| `rules/database.mdc`              | Prisma schema design (naming, relations), migration strategy, query optimization, N+1 prevention (`include`/`select`), transactions for multi-step writes, connection pooling, pagination                                                                                    | `prisma/schema.prisma`, `src/lib/queries/`, server actions |
| `rules/typescript.mdc`            | Interfaces for object shapes (not `type`), strict mode, no `any` (use `unknown`), explicit return types on all functions, discriminated unions for result types, `UPPER_CASE` constants, `camelCase` variables                                                               | All `.ts` and `.tsx` files                                 |
| `rules/tailwind.mdc`              | Utility classes over custom CSS, `@apply` for grouped utilities, shadcn/ui components, mobile-first responsive design, consistent color variants, dark mode support                                                                                                          | All UI components                                          |
| `rules/clean-code.mdc`            | Named constants over magic numbers, meaningful variable names that reveal purpose, single responsibility per function, DRY (extract reusable functions), self-documenting code                                                                                               | All files                                                  |
| `rules/anti-overengineering.mdc`  | Only change what was asked, simplest solution first, no unnecessary abstractions, no importing unnecessary deps, no rewriting entire files for small changes                                                                                                                 | All changes                                                |
| `rules/nextjs-tanstack-query.mdc` | HydrationBoundary pattern (Server Components prefetch, Client Components consume), Server Actions as `mutationFn`, queryOptions factory pattern, `useMutation` with `onSuccess`/`onError` invalidation, optimistic updates with rollback                                     | Client components with data fetching                       |
| `rules/codequality.mdc`           | Preserve existing code (no removing unrelated functionality), single-chunk edits, no whitespace-only changes, no inventing unrequested changes                                                                                                                               | All file edits                                             |
| `rules/gitflow.mdc`               | Feature branch `feature/phase-8-*`, conventional commits (`feat:`, `fix:`), PR reviews, no direct commits to main/develop                                                                                                                                                    | All commits                                                |

---

## Objective 1: Patient UI & Booking Flow Audit

### 1.1 Patient Dashboard & Calendar Visual Cleanup

**Rule Mapping:** `rules/react.mdc` (component structure, accessibility), `rules/tailwind.mdc` (responsive design, shadcn/ui), `rules/clean-code.mdc` (meaningful names, single responsibility, DRY), `rules/anti-overengineering.mdc` (scope only requested changes), `rules/typescript.mdc` (explicit types)

**Current Issues Identified:**

1. **`src/app/dashboard/patients/[id]/page.tsx:11-27`** — `statusLabels` and `statusColors` maps are duplicated between this file and `src/components/calendar/booking-modal.tsx:108-128`. This violates DRY (`clean-code.mdc`).
2. **`src/app/dashboard/patients/[id]/page.tsx:11-27`** — Missing `NEEDS_RESCHEDULE` and `RESCHEDULE_REQUESTED` statuses in the maps (only 6 of 8 statuses). Patients with these statuses will see raw enum strings.
3. **`src/app/dashboard/page.tsx:19-39`** — The `PatientDashboard` component has its own `statusBadge` and `statusIcon` maps that are _different_ from both the patient detail page and booking modal (uses `bg-blue-100 text-blue-700 border-blue-200` vs `text-blue-600 bg-blue-50`). Three separate status styling systems exist.
4. **`src/app/dashboard/calendar/page.tsx`** — Calendar legend is hardcoded inline with Tailwind classes; should be extracted into a reusable component.
5. **`src/components/dashboard/sidebar.tsx:28-89`** — No "Notifications" link in sidebar navigation; notifications are only accessible via the bell dropdown.

**Planned Changes:**

| Step | File                                                | Change                                                                                                                                                                                                                                                                                                                                                                                  | Rules                                                                                                                                                        |
| ---- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1a | `src/lib/constants/appointment-status.ts` (NEW)     | Extract ALL status styling into a single shared constants file. Export `statusLabels` (Record<string, string>), `statusColors` (Record<string, string> for bg/text), `statusBadgeStyles` (Record<string, string> for border variants used in dashboard), and `statusIcons` (Record<string, LucideIcon>) for all 8 `AppointmentStatus` values. Use `as const` satisfies for type safety. | `clean-code.mdc` (DRY, named constants over magic), `typescript.mdc` (interfaces, `as const`, no `any`), `anti-overengineering.mdc` (single source of truth) |
| 1.1b | `src/app/dashboard/patients/[id]/page.tsx`          | Import shared `statusLabels` and `statusColors` from constants. Remove inline maps. Add `NEEDS_RESCHEDULE` and `RESCHEDULE_REQUESTED` to the patient detail view (they were missing).                                                                                                                                                                                                   | `react.mdc` (composition, reusable logic), `clean-code.mdc` (DRY)                                                                                            |
| 1.1c | `src/components/calendar/booking-modal.tsx`         | Replace inline `statusLabels` (line 108-117) and `statusColors` (line 119-128) with shared constants import.                                                                                                                                                                                                                                                                            | `clean-code.mdc` (DRY), `anti-overengineering.mdc` (minimal change — swap import only)                                                                       |
| 1.1d | `src/app/dashboard/page.tsx`                        | Replace inline `statusBadge` (line 19-28) and `statusIcon` (line 30-39) in `PatientDashboard` with shared constants import. This unifies the 3rd styling system.                                                                                                                                                                                                                        | `clean-code.mdc` (DRY — eliminate triple duplication), `react.mdc` (composition)                                                                             |
| 1.1e | `src/components/calendar/calendar-legend.tsx` (NEW) | Extract legend from `calendar/page.tsx` into a dedicated client component. Props: `statusFilter?: AppointmentStatus[]` to optionally show subset. Uses shared `statusLabels` and `statusColors` constants.                                                                                                                                                                              | `react.mdc` (small focused component), `tailwind.mdc` (consistent styling), `typescript.mdc` (typed props)                                                   |
| 1.1f | `src/app/dashboard/calendar/page.tsx`               | Replace inline legend with `<CalendarLegend />` component.                                                                                                                                                                                                                                                                                                                              | `react.mdc` (composition), `nextjs.mdc` (component organization)                                                                                             |

### 1.2 Booking Flow Bug Fixes

**Rule Mapping:** `rules/react.mdc` (error handling, controlled components), `rules/nextjs.mdc` (forms, Zod validation), `rules/typescript.mdc` (strict null checking, explicit types), `rules/postgresql.mdc` (schema integrity)

**Current Issues Identified:**

1. **`src/lib/schemas/appointment.ts:3-10`** — `appointmentStatuses` array is missing `NEEDS_RESCHEDULE` and `RESCHEDULE_REQUESTED` (only 6 of 8 statuses). This means Zod validation via `updateAppointmentSchema` would reject these statuses if used in form schemas — a data integrity gap.
2. **`src/components/calendar/booking-modal.tsx:74-83`** — The `bookingFormSchema` validates `startTime` and `endTime` as required strings but does NOT validate `endTime > startTime`. A user can submit a booking where the end is before the start. The server action catches this (`appointments.ts:40-42`), but the UI provides no client-side feedback.
3. **`src/app/dashboard/calendar/page.tsx`** — The calendar page wraps content in `Suspense` but the `CalendarPageContent` component has no `ErrorBoundary` — if TanStack Query fails, the error is unhandled at the page level.

**Planned Changes:**

| Step | File                                        | Change                                                                                                                                                                                                                                            | Rules                                                                                                                                  |
| ---- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1.2a | `src/lib/schemas/appointment.ts`            | Add `NEEDS_RESCHEDULE` and `RESCHEDULE_REQUESTED` to `appointmentStatuses` array. Add a `.refine()` to `createAppointmentSchema` ensuring `endTime > startTime` with message "End time must be after start time". Export the refined schema type. | `postgresql.mdc` (schema integrity), `typescript.mdc` (strict types, explicit validation), `nextjs.mdc` (Zod validation at boundaries) |
| 1.2b | `src/components/calendar/booking-modal.tsx` | Add client-side validation feedback when `endTime <= startTime` using the Zod refine. Show inline error message below the time fields using the existing error styling pattern (`text-xs text-destructive`).                                      | `react.mdc` (forms, error handling, controlled components), `tailwind.mdc` (error state styling)                                       |
| 1.2c | `src/app/dashboard/calendar/page.tsx`       | Wrap `CalendarPageContent` in an error boundary or add `error.tsx` route segment for `/dashboard/calendar/error.tsx`. Show a user-friendly fallback with retry option.                                                                            | `react.mdc` (error boundaries), `nextjs.mdc` (loading/error states via file conventions)                                               |

### 1.3 Patient Detail Page Enhancements

**Rule Mapping:** `rules/react.mdc` (component structure, accessibility), `rules/tailwind.mdc` (responsive design, shadcn/ui), `rules/nextjs.mdc` (Server Components vs Client Components, data fetching), `rules/typescript.mdc` (typed props)

**Current Issues Identified:**

1. **`src/app/dashboard/patients/[id]/page.tsx`** — Patient detail page shows only basic info (email, phone, DOB, notes) and appointment history. It does NOT show which providers are linked to this patient.
2. **`src/app/dashboard/patients/[id]/page.tsx:82-123`** — When `patient.appointments.length === 0`, there is no empty state; the section is simply hidden. A prompt to book the first appointment would improve UX.

**Planned Changes:**

| Step | File                                       | Change                                                                                                                                                                                                                                                                                                                                                  | Rules                                                                                                                                                          |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.3a | `src/app/dashboard/patients/[id]/page.tsx` | Add a "Linked Providers" section between patient info and appointment history. Use `getPatientLinkedProviders` server action to fetch linked providers. Display as a card grid with provider name, specialty, and link date. For ADMIN/RECEPTIONIST, add a "Book Appointment" quick action button that opens the calendar pre-filtered to this patient. | `react.mdc` (composition, new section), `nextjs.mdc` (data fetching via TanStack Query), `tailwind.mdc` (responsive card grid), `typescript.mdc` (typed props) |
| 1.3b | `src/app/dashboard/patients/[id]/page.tsx` | Add an empty state for appointment history: "No appointments yet. Book your first appointment with [Patient Name]." with a link to `/dashboard/calendar`.                                                                                                                                                                                               | `react.mdc` (empty states, accessibility), `tailwind.mdc` (consistent empty state styling)                                                                     |

---

## Objective 2: Dedicated Notifications Page

### 2.1 Database & Server Actions

**Rule Mapping:** `rules/postgresql.mdc` (TIMESTAMPTZ, UUID PKs, parameterized queries, LIMIT), `rules/database.mdc` (Prisma patterns, query optimization, N+1 prevention), `rules/typescript.mdc` (interfaces, explicit return types, discriminated unions), `rules/ai-agent-specialist.mdc` (custom error types)

**Current State:** The existing notification system (`src/server/actions/notifications.ts`) only supports `getMyUnreadNotifications()` (last 20) and `getUnreadCount()`. There is no way to view read notifications or get paginated history. The `NotificationBell` component (`src/components/notifications/notification-bell.tsx`) shows only unread notifications in a dropdown.

**Planned Changes:**

| Step | File                                     | Change                                                                                                                                                                                                                                                                                         | Rules                                                                                                         |
| ---- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 2.1a | `src/server/actions/notifications.ts`    | Add `getAllMyNotifications({ page: number, limit: number, filter?: "all"                                                                                                                                                                                                                       | "unread"                                                                                                      | "read" })`server action. Paginated query returning all notifications (read + unread) for the current user, ordered by`createdAt`DESC. Return type:`{ success: true, notifications: Notification[], total: number, page: number, pageSize: number }`. Use Prisma `skip`/`take`for pagination. Include`sender`relation with`select: { id, name, image }`. | `postgresql.mdc` (LIMIT via take, parameterized queries), `database.mdc` (pagination, explicit select), `typescript.mdc` (explicit return types, discriminated union result) |
| 2.1b | `src/server/actions/notifications.ts`    | Add `getNotificationStats()` server action. Returns `{ success: true, total: number, unread: number, read: number, actioned: number }` using `db.notification.groupBy` or individual `count` queries.                                                                                          | `postgresql.mdc` (aggregation), `database.mdc` (query optimization), `typescript.mdc` (typed return)          |
| 2.1c | `src/lib/queries/notifications.ts` (NEW) | Create TanStack Query definitions using `queryOptions` factory pattern. Export `allNotificationsQuery({ page, limit, filter })` and `notificationStatsQuery()`. Define stable, serializable query keys: `["notifications", "list", { page, limit, filter }]` and `["notifications", "stats"]`. | `rules/nextjs-tanstack-query.mdc` (queryOptions factory, stable query keys), `typescript.mdc` (typed exports) |

### 2.2 Notifications Page UI

**Rule Mapping:** `rules/react.mdc` (component structure, hooks, accessibility, memoization), `rules/nextjs.mdc` (App Router, Server Components, `'use client'` only when needed), `rules/tailwind.mdc` (shadcn/ui components, responsive design), `rules/clean-code.mdc` (single responsibility), `rules/anti-overengineering.mdc` (simplest solution, reuse existing patterns)

**Planned Changes:**

| Step | File                                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Rules                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.2a | `src/app/dashboard/notifications/page.tsx` (NEW)           | Create dedicated notifications page route. **Server Component** that prefetches notification stats and initial page of notifications, then renders inside `HydrationBoundary`. Includes page header "Notifications" with unread count badge.                                                                                                                                                                                                                                                                                         | `nextjs.mdc` (App Router, Server Components by default), `nextjs-tanstack-query.mdc` (HydrationBoundary pattern — Server Component prefetches, Client Component consumes)                     |
| 2.2b | `src/components/notifications/notification-list.tsx` (NEW) | `'use client'` component. Paginated list of all notifications. Features: (1) Filter tabs: All / Unread / Read (using `Tabs` from shadcn/ui). (2) Each row shows notification type icon, message (truncated to 2 lines), sender name, relative timestamp, read/unread indicator dot. (3) "Mark all as read" button in header (calls existing `markAllAsRead`). (4) Infinite scroll or "Load more" pagination. (5) Clicking a notification marks it read and navigates to relevant page. Uses `useQuery` with `allNotificationsQuery`. | `react.mdc` (component structure, hooks, accessibility, memoization for rows), `tailwind.mdc` (shadcn/ui Tabs, Card, Button, Badge), `nextjs-tanstack-query.mdc` (useQuery with queryOptions) |
| 2.2c | `src/components/notifications/notification-row.tsx` (NEW)  | Individual notification row component. Props: `notification: NotificationData`, `onMarkRead: (id: string) => void`. Displays: (1) Type-specific icon (from shared constants), (2) Sender name (bold if unread), (3) Message preview (2-line clamp), (4) Relative timestamp ("2 hours ago" via `Intl.RelativeTimeFormat`), (5) Read/unread dot indicator (blue dot for unread, hidden for read). Uses `memo` to prevent unnecessary re-renders.                                                                                       | `react.mdc` (small focused component, memoization, accessibility), `tailwind.mdc` (responsive layout, semantic colors), `typescript.mdc` (typed props interface)                              |
| 2.2d | `src/components/notifications/notification-bell.tsx`       | Update click handler: when a notification is clicked, navigate to `/dashboard/notifications` as the default route. Keep existing specific routing for `leave_notification` -> `/dashboard/calendar`, `booking_request` -> `/dashboard/receptionist/requests`, `reschedule_request` -> `/dashboard/receptionist/reschedule`.                                                                                                                                                                                                          | `react.mdc` (controlled navigation), `anti-overengineering.mdc` (minimal change — add else clause)                                                                                            |
| 2.2e | `src/components/dashboard/sidebar.tsx`                     | Add "Notifications" nav item to the sidebar with `Bell` icon. Visible to ALL roles (`["ADMIN", "PROVIDER", "RECEPTIONIST", "PATIENT"]`). Add unread count badge next to the label using the existing `getUnreadCount` query. Add `nav.notifications` key to i18n translations.                                                                                                                                                                                                                                                       | `nextjs.mdc` (routing), `tailwind.mdc` (navigation styling, badge), `react.mdc` (composition)                                                                                                 |
| 2.2f | `src/lib/i18n/translations.ts`                             | Add translation key: `"nav.notifications": "Notifications"` for English and Arabic.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `clean-code.mdc` (i18n consistency)                                                                                                                                                           |

### 2.3 Notification Type Routing Constants

**Rule Mapping:** `rules/typescript.mdc` (discriminated unions, typed maps), `rules/clean-code.mdc` (named constants, DRY, single source of truth)

**Planned Changes:**

| Step | File                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Rules                                                                                                                                |
| ---- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 2.3a | `src/lib/constants/notification-types.ts` (NEW)      | Define a typed `NotificationTypeConfig` interface: `{ label: string, icon: LucideIcon, route: string, color: string }`. Export a `NOTIFICATION_TYPES` map: `Record<string, NotificationTypeConfig>` with entries for: `leave_notification` (icon: `CalendarOff`, route: `/dashboard/calendar`), `reschedule_request` (icon: `CalendarClock`, route: `/dashboard/receptionist/reschedule`), `booking_request` (icon: `MessageSquare`, route: `/dashboard/receptionist/requests`), `patient_reschedule_request` (icon: `Clock`, route: `/dashboard`), `emergency_cancellation` (icon: `AlertTriangle`, route: `/dashboard/calendar`, color: `amber`). | `typescript.mdc` (discriminated unions, typed map), `clean-code.mdc` (named constants, DRY — single source of truth for all routing) |
| 2.3b | `src/components/notifications/notification-bell.tsx` | Replace the inline `if/else if` routing chain (lines 112-126) with a lookup into `NOTIFICATION_TYPES[n.type]?.route`. Fall back to `/dashboard/notifications` if type is unknown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `clean-code.mdc` (DRY, use shared map), `anti-overengineering.mdc` (minimal change)                                                  |
| 2.3c | `src/components/notifications/notification-list.tsx` | Use `NOTIFICATION_TYPES[n.type]?.icon` for type-specific icon display and `NOTIFICATION_TYPES[n.type]?.route` for click navigation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `clean-code.mdc` (DRY)                                                                                                               |

---

## Objective 3: Doctor Emergency Cancellation Feature

### 3.1 Database Schema Changes

**Rule Mapping:** `rules/postgresql.mdc` (TIMESTAMPTZ, UUID, NOT NULL, FK with ON DELETE, versioned migrations, safe DDL), `rules/database.mdc` (Prisma schema design, enum values, migration strategy), `rules/typescript.mdc` (enum types)

**Current State:** The `cancelDayForProvider` action (`src/server/actions/appointments.ts:262-331`) already exists and is provider-only. It:

- Sets active appointments to `NEEDS_RESCHEDULE`
- Notifies RECEPTIONIST/ADMIN users only
- Does NOT notify patients
- Cannot be triggered by admin/receptionist on behalf of a provider

The new `emergencyCancelDoctorDay` action will be admin/receptionist-accessible and will also create patient-facing notifications.

**Planned Changes:**

| Step | File                             | Change                                                                                                                                                                                                                                                   | Rules                                                                                                               |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 3.1a | `prisma/schema.prisma`           | Add `EMERGENCY_CANCELLED` to the `AppointmentStatus` enum. This distinguishes emergency cancellations from regular `NEEDS_RESCHEDULE` (which is provider-initiated). The `NEEDS_RESCHEDULE` status will remain for provider-initiated day cancellations. | `postgresql.mdc` (enum values, schema design), `database.mdc` (Prisma schema, enum management)                      |
| 3.1b | `prisma/migrations/` (NEW)       | Create versioned migration: `YYYYMMDDHHMMSS_add_emergency_cancelled_status.sql` with: `ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'EMERGENCY_CANCELLED';`. Use `CREATE INDEX CONCURRENTLY` if adding any new indexes.                        | `postgresql.mdc` (versioned migrations, safe DDL with `IF NOT EXISTS`, `CREATE INDEX CONCURRENTLY` for live tables) |
| 3.1c | `src/lib/schemas/appointment.ts` | Add `EMERGENCY_CANCELLED` to the `appointmentStatuses` array to keep Zod schema in sync.                                                                                                                                                                 | `typescript.mdc` (schema consistency), `nextjs.mdc` (Zod validation)                                                |

### 3.2 Server Action: Admin/Receptionist Emergency Cancellation

**Rule Mapping:** `rules/nextjs.mdc` (Server Actions, `'use server'`), `rules/postgresql.mdc` (transactions, parameterized queries, SELECT explicit columns), `rules/database.mdc` (Prisma transactions, N+1 prevention), `rules/typescript.mdc` (explicit return types, discriminated unions), `rules/ai-agent-specialist.mdc` (custom error handling, max 20 lines per function), `rules/clean-code.mdc` (single responsibility, named constants)

**Current State:** `cancelDayForProvider` is in `src/server/actions/appointments.ts:262-331`. It only accepts a `date` string and uses `session.user.id` to find the provider. The new action will accept `providerId` and `date` as parameters (admin/receptionist can cancel for any provider).

**Planned Changes:**

| Step | File                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Rules                                                                                                                                                                                                                                                                                                           |
| ---- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.2a | `src/server/actions/appointments.ts`               | Create `emergencyCancelDoctorDay(providerId: string, date: string)` server action. **Access:** ADMIN and RECEPTIONIST only (check `session.user.role`). **Logic:** (1) Validate inputs with Zod `emergencyCancelSchema`. (2) Verify provider exists and is active. (3) Find all `SCHEDULED`/`CONFIRMED`/`IN_PROGRESS` appointments for the provider on that date (exclude `CANCELLED`, `NO_SHOW`, `COMPLETED`, `EMERGENCY_CANCELLED`). (4) In a Prisma `$transaction`: update each appointment status to `EMERGENCY_CANCELLED`. (5) For each affected appointment, create a notification for the patient using the emergency cancellation message template. (6) Return `{ success: true, flagged: number, notificationsSent: number }`. | `postgresql.mdc` (transactions for atomicity, explicit column selection), `database.mdc` (Prisma `$transaction`, N+1 prevention via `createMany`), `typescript.mdc` (explicit return type as discriminated union), `ai-agent-specialist.mdc` (error handling), `clean-code.mdc` (SRP — one action, one purpose) |
| 3.2b | `src/lib/schemas/appointment.ts`                   | Add `emergencyCancelSchema`: `{ providerId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format") }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `nextjs.mdc` (Zod validation at boundaries), `typescript.mdc` (typed schema)                                                                                                                                                                                                                                    |
| 3.2c | `src/lib/constants/notification-messages.ts` (NEW) | Define patient notification message template as a named constant: `EMERGENCY_CANCELLATION_MESSAGE = (providerName: string) => \`Doctor ${providerName} has an unforeseen emergency. Your appointment has been temporarily paused, and the clinic will propose a new time for you shortly.\``. Also define staff notification template: `EMERGENCY_CANCELLATION_STAFF_MESSAGE = (providerName: string, date: string) => \`Emergency: Dr. ${providerName}'s schedule for ${date} has been cancelled. All affected appointments flagged for rescheduling.\``.                                                                                                                                                                              | `clean-code.mdc` (named constants, no magic strings, factory function for dynamic content), `typescript.mdc` (typed function signature)                                                                                                                                                                         |

### 3.3 Notification Logic for Emergency Cancellation

**Rule Mapping:** `rules/postgresql.mdc` (parameterized queries, batch operations, explicit columns), `rules/database.mdc` (Prisma `createMany` for N+1 prevention, transactions), `rules/typescript.mdc` (typed returns)

**Planned Changes:**

| Step | File                                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Rules                                                                                                                                                              |
| ---- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.3a | `src/server/actions/notifications.ts`                                | Add `createBulkNotifications({ senderId: string, receiverIds: string[], type: string, message: string, relatedEntityId: string, relatedEntityType: string })` helper. Uses Prisma `createMany` for efficient bulk insert. Returns `{ created: number }`. This avoids N+1 `create` calls in a loop.                                                                                                                                                                                                 | `postgresql.mdc` (batch operations, parameterized), `database.mdc` (N+1 prevention via `createMany`), `typescript.mdc` (explicit types, typed params as interface) |
| 3.3b | `src/server/actions/appointments.ts` (in `emergencyCancelDoctorDay`) | After updating appointments in the transaction: (1) Collect unique patient IDs from affected appointments. (2) Fetch patient user IDs via `db.patient.findMany` with `select: { userId: true }`. (3) Call `createBulkNotifications` to create one notification per affected patient. Each notification uses `type: "emergency_cancellation"`, `relatedEntityId: appointmentId`, `relatedEntityType: "appointment"`. (4) Also notify all RECEPTIONIST/ADMIN users using the staff message template. | `clean-code.mdc` (DRY — reuse `createBulkNotifications` helper), `anti-overengineering.mdc` (compose existing actions)                                             |

### 3.4 UI: Emergency Cancellation Button & Dialog

**Rule Mapping:** `rules/react.mdc` (component structure, controlled components, error handling, hooks), `rules/nextjs.mdc` (forms, loading states), `rules/tailwind.mdc` (shadcn/ui Dialog, Button, Alert), `rules/nextjs-tanstack-query.mdc` (useMutation, invalidateQueries), `rules/anti-overengineering.mdc` (minimal change, reuse existing patterns)

**Current State:** The calendar page (`src/app/dashboard/calendar/page.tsx:70-72`) already has `cancelDayOpen` state and a `CancelDayDialog` for providers. The new emergency cancel dialog is a separate, admin/receptionist-only feature.

**Planned Changes:**

| Step | File                                                        | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Rules                                                                                                                                                                                                     |
| ---- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.4a | `src/components/calendar/emergency-cancel-dialog.tsx` (NEW) | Confirmation dialog component. Features: (1) Provider selector dropdown (pre-selected if admin clicked from a specific provider's calendar view). (2) Date picker (defaults to today). (3) Warning alert: "This will cancel all scheduled appointments for this provider on [date] and notify affected patients. This action cannot be undone." (4) Confirm button (destructive variant) and Cancel button. (5) Loading state during mutation. (6) Uses `useMutation` to call `emergencyCancelDoctorDay`. (7) On success: invalidate `appointments`, `notifications`, and `unreadCount` queries. Show toast: "Emergency cancellation processed. [N] appointments affected, [M] patients notified." | `react.mdc` (component structure, controlled components, error handling), `nextjs-tanstack-query.mdc` (useMutation with onSuccess invalidation), `tailwind.mdc` (shadcn/ui Dialog, Button, Alert, Select) |
| 3.4b | `src/app/dashboard/calendar/page.tsx`                       | Add "Emergency Cancel Day" button visible only to ADMIN and RECEPTIONIST roles. Place it in the calendar header area (next to existing filter/provider controls). Opens `EmergencyCancelDialog`. Wire up state management (`emergencyCancelOpen`, `setEmergencyCancelOpen`).                                                                                                                                                                                                                                                                                                                                                                                                                       | `react.mdc` (controlled components, conditional rendering by role), `tailwind.mdc` (Button variant destructive), `nextjs.mdc` (loading states)                                                            |
| 3.4c | `src/app/dashboard/calendar/page.tsx`                       | Pass selected provider and date context to `EmergencyCancelDialog` when opened from a provider-specific view. Add success/error toast handling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `react.mdc` (state management, hooks), `anti-overengineering.mdc` (reuse existing toast pattern from `cancelDayForProvider`)                                                                              |

### 3.5 Patient-Facing Notification Display

**Rule Mapping:** `rules/react.mdc` (accessibility, semantic HTML), `rules/tailwind.mdc` (responsive design, color semantics for urgency), `rules/clean-code.mdc` (named constants)

**Planned Changes:**

| Step | File                                                 | Change                                                                                                                                                                                                                                                                                         | Rules                                                                                                  |
| ---- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 3.5a | `src/components/notifications/notification-row.tsx`  | Ensure `emergency_cancellation` notification type displays with `AlertTriangle` icon and amber/red color treatment (`bg-amber-50 border-l-2 border-amber-400`) to visually distinguish from regular notifications. Add `aria-label` for screen readers: "Emergency cancellation notification". | `react.mdc` (accessibility, semantic HTML), `tailwind.mdc` (semantic colors for urgency, icon styling) |
| 3.5b | `src/lib/constants/notification-types.ts`            | Add `emergency_cancellation` entry to `NOTIFICATION_TYPES` map: `{ label: "Emergency Cancellation", icon: AlertTriangle, route: "/dashboard/calendar", color: "amber" }`.                                                                                                                      | `clean-code.mdc` (named constants), `typescript.mdc` (typed map entry)                                 |
| 3.5c | `src/components/notifications/notification-bell.tsx` | The bell already uses the shared `NOTIFICATION_TYPES` map (from step 2.3b), so the emergency_cancellation route is automatically handled. Verify the routing works correctly.                                                                                                                  | `clean-code.mdc` (DRY), `anti-overengineering.mdc` (no additional change needed if 2.3b is done)       |

---

## Execution Order

The work should be executed in this sequence to minimize conflicts and ensure each step builds on the previous. Dependencies are explicit — no step should begin before its dependency is complete.

| Order | Step                                        | Dependency       | Estimated Complexity | Risk                   |
| ----- | ------------------------------------------- | ---------------- | -------------------- | ---------------------- |
| 1     | 1.1a — Shared status constants              | None             | Low                  | Low                    |
| 2     | 1.1b — Patient detail status fix            | 1.1a             | Low                  | Low                    |
| 3     | 1.1c — Booking modal status fix             | 1.1a             | Low                  | Low                    |
| 4     | 1.1d — Dashboard patient status fix         | 1.1a             | Low                  | Low                    |
| 5     | 1.1e — Calendar legend component            | None             | Low                  | Low                    |
| 6     | 1.1f — Calendar page legend refactor        | 1.1e             | Low                  | Low                    |
| 7     | 1.2a — Zod schema fixes                     | None             | Low                  | Low                    |
| 8     | 1.2b — Booking modal validation             | 1.2a             | Low                  | Low                    |
| 9     | 1.2c — Calendar error boundary              | None             | Low                  | Low                    |
| 10    | 1.3a — Patient detail enhancements          | None             | Medium               | Low                    |
| 11    | 1.3b — Patient detail empty states          | None             | Low                  | Low                    |
| 12    | 3.1a — Prisma enum migration                | None             | Low                  | Medium (schema change) |
| 13    | 3.1b — Migration file                       | 3.1a             | Low                  | Medium                 |
| 14    | 3.1c — Zod schema sync                      | 3.1a             | Low                  | Low                    |
| 15    | 3.2c — Notification message constants       | None             | Low                  | Low                    |
| 16    | 3.3a — Bulk notification helper             | None             | Medium               | Low                    |
| 17    | 3.2a — Emergency cancel server action       | 3.1b, 3.2c, 3.3a | High                 | Medium (transactional) |
| 18    | 3.2b — Emergency cancel Zod schema          | 3.2a             | Low                  | Low                    |
| 19    | 2.1a — Paginated notifications action       | None             | Medium               | Low                    |
| 20    | 2.1b — Notification stats action            | None             | Low                  | Low                    |
| 21    | 2.1c — Notification query definitions       | 2.1a, 2.1b       | Low                  | Low                    |
| 22    | 2.3a — Notification type constants          | None             | Low                  | Low                    |
| 23    | 2.2a — Notifications page route             | 2.1c             | Medium               | Low                    |
| 24    | 2.2b — Notification list component          | 2.1a, 2.3a       | High                 | Low                    |
| 25    | 2.2c — Notification row component           | 2.3a             | Medium               | Low                    |
| 26    | 2.2d — Bell click handler update            | 2.3a             | Low                  | Low                    |
| 27    | 2.2e — Sidebar notifications link           | None             | Low                  | Low                    |
| 28    | 2.2f — i18n translations                    | None             | Low                  | Low                    |
| 29    | 2.3b — Bell routing refactor                | 2.3a             | Low                  | Low                    |
| 30    | 2.3c — List routing refactor                | 2.3a             | Low                  | Low                    |
| 31    | 3.4a — Emergency cancel dialog              | 3.2a, 3.2b       | Medium               | Low                    |
| 32    | 3.4b — Emergency cancel button in calendar  | 3.4a             | Medium               | Low                    |
| 33    | 3.4c — Wire up emergency cancel flow        | 3.4a, 3.4b       | Low                  | Low                    |
| 34    | 3.5a — Emergency notification display       | 2.2c, 3.2a       | Low                  | Low                    |
| 35    | 3.5b — Emergency notification type constant | 2.3a, 3.2a       | Low                  | Low                    |
| 36    | 3.5c — Bell emergency routing               | 3.5b             | Low                  | Low                    |

---

## Files Changed Summary

| File                                                     | Action | Objective     | Steps                  |
| -------------------------------------------------------- | ------ | ------------- | ---------------------- |
| `src/lib/constants/appointment-status.ts`                | CREATE | 1.1           | 1.1a                   |
| `src/lib/constants/notification-types.ts`                | CREATE | 2.3, 3.5      | 2.3a, 3.5b             |
| `src/lib/constants/notification-messages.ts`             | CREATE | 3.2           | 3.2c                   |
| `src/lib/schemas/appointment.ts`                         | MODIFY | 1.2, 3.1      | 1.2a, 3.1c             |
| `src/lib/queries/notifications.ts`                       | CREATE | 2.1           | 2.1c                   |
| `src/lib/i18n/translations.ts`                           | MODIFY | 2.2           | 2.2f                   |
| `src/server/actions/notifications.ts`                    | MODIFY | 2.1, 3.3      | 2.1a, 2.1b, 3.3a       |
| `src/server/actions/appointments.ts`                     | MODIFY | 3.2           | 3.2a                   |
| `src/app/dashboard/notifications/page.tsx`               | CREATE | 2.2           | 2.2a                   |
| `src/app/dashboard/patients/[id]/page.tsx`               | MODIFY | 1.1, 1.3      | 1.1b, 1.3a, 1.3b       |
| `src/app/dashboard/page.tsx`                             | MODIFY | 1.1           | 1.1d                   |
| `src/app/dashboard/calendar/page.tsx`                    | MODIFY | 1.1, 1.2, 3.4 | 1.1f, 1.2c, 3.4b, 3.4c |
| `src/app/dashboard/calendar/error.tsx`                   | CREATE | 1.2           | 1.2c                   |
| `src/components/calendar/booking-modal.tsx`              | MODIFY | 1.1, 1.2      | 1.1c, 1.2b             |
| `src/components/calendar/calendar-legend.tsx`            | CREATE | 1.1           | 1.1e                   |
| `src/components/calendar/emergency-cancel-dialog.tsx`    | CREATE | 3.4           | 3.4a                   |
| `src/components/notifications/notification-list.tsx`     | CREATE | 2.2           | 2.2b                   |
| `src/components/notifications/notification-row.tsx`      | CREATE | 2.2, 3.5      | 2.2c, 3.5a             |
| `src/components/notifications/notification-bell.tsx`     | MODIFY | 2.2, 2.3, 3.5 | 2.2d, 2.3b, 3.5c       |
| `src/components/dashboard/sidebar.tsx`                   | MODIFY | 2.2           | 2.2e                   |
| `prisma/schema.prisma`                                   | MODIFY | 3.1           | 3.1a                   |
| `prisma/migrations/YYYYMMDD_add_emergency_cancelled.sql` | CREATE | 3.1           | 3.1b                   |

**Total Files:** 22 (10 CREATE, 12 MODIFY)

---

## Testing Checklist

After implementation, verify:

### Objective 1 — Patient UI & Booking Flow

- [ ] All 8 appointment statuses render correctly in patient dashboard (`src/app/dashboard/page.tsx`)
- [ ] All 8 appointment statuses render correctly in patient detail page (`src/app/dashboard/patients/[id]/page.tsx`)
- [ ] All 8 appointment statuses render correctly in booking modal (`src/components/calendar/booking-modal.tsx`)
- [ ] No duplicated status constants — all files import from `src/lib/constants/appointment-status.ts`
- [ ] Zod validation rejects invalid time ranges (`endTime <= startTime`) with clear error message
- [ ] Calendar legend displays correctly and is responsive
- [ ] Patient detail page shows linked providers section
- [ ] Patient detail page shows empty state when no appointments exist
- [ ] Calendar error boundary catches and displays query failures gracefully

### Objective 2 — Notifications Page

- [ ] Notifications page loads with paginated list (read + unread)
- [ ] Filter tabs (All / Unread / Read) work correctly
- [ ] "Mark all as read" updates all notifications and clears bell badge
- [ ] Clicking a notification marks it as read and navigates to correct page
- [ ] Notification stats display correctly (total, unread, read, actioned)
- [ ] Sidebar "Notifications" link visible to all roles
- [ ] Sidebar shows unread count badge
- [ ] Notification type icons display correctly for each notification type
- [ ] i18n translations work for "Notifications" label

### Objective 3 — Emergency Cancellation

- [ ] Emergency cancel button only visible to ADMIN and RECEPTIONIST roles
- [ ] Emergency cancel dialog opens with provider selector and date picker
- [ ] Emergency cancellation creates `EMERGENCY_CANCELLED` status on affected appointments
- [ ] Emergency cancellation sends notification to ALL affected patients with correct message: "Doctor [Name] has an unforeseen emergency. Your appointment has been temporarily paused, and the clinic will propose a new time for you shortly."
- [ ] Emergency cancellation also notifies RECEPTIONIST/ADMIN users
- [ ] Patient receives notification with correct doctor name in the message
- [ ] Emergency cancellation notification displays with amber/warning styling in notification list
- [ ] Emergency cancellation notification routes to `/dashboard/calendar` when clicked
- [ ] All affected appointments are updated in a single transaction (no partial updates)
- [ ] No `SELECT *` in any new queries (Prisma handles this, but verify explicit selects)
- [ ] All new server actions validate inputs with Zod before DB operations
- [ ] Prisma migration runs cleanly without data loss

### General Quality

- [ ] No unrelated files modified (per `rules/anti-overengineering.mdc`)
- [ ] All commits follow conventional format: `feat(scope): description` or `fix(scope): description`
- [ ] All new components have proper loading and error states
- [ ] All new components are accessible (semantic HTML, ARIA labels where needed)
- [ ] All new TypeScript code has explicit return types (no implicit `any`)
- [ ] No `console.log` statements in production code
- [ ] All new server actions handle errors gracefully and return typed results

---

_This plan is awaiting explicit approval before any code is written._
