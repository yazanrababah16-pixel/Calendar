# Phase 2: UI & Workflows — Execution Plan

## UI/UX Execution Table

| #   | Priority | Category         | Page / Component                                              | Role(s)                | What To Build / Change                                                                                                                                                                                                                          | Server Action(s)                                                     |
| --- | -------- | ---------------- | ------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | P2       | **Global**       | `src/app/dashboard/settings/page.tsx`                         | ALL                    | **Profile section** — Name, Email, Username edit with Zod validation, loading state, success toast; **Password section** — Current/New/Confirm with client-side match check; **Admin section** — User select with search, inline password reset | `updateProfile`, `changePassword`, `listUsers`, `updateUserPassword` |
| 2   | P2       | **Global**       | `src/components/layout/sidebar.tsx`                           | ALL                    | RBAC nav items per role table (see §5.2); highlight active; collapse on mobile                                                                                                                                                                  | —                                                                    |
| 3   | P2       | **Global**       | `src/components/ui/role-guard.tsx` (new)                      | ALL                    | `<RoleGuard allowedRoles={[...]}>` wrapper hides children if role mismatch                                                                                                                                                                      | —                                                                    |
| 4   | P2       | **Global**       | `src/components/notifications/notification-bell.tsx` (new)    | RECEPTIONIST, PROVIDER | Bell icon in header; unread count badge; dropdown of recent notifications; mark-as-read action                                                                                                                                                  | `getNotifications`, `markNotificationRead`                           |
| 5   | **P1**   | **Receptionist** | `src/app/dashboard/calendar/page.tsx`                         | RECEPTIONIST           | Scope to assigned providers; provider filter chip bar; show only appointments for those providers                                                                                                                                               | `getAssignedProviders`, `getAppointments` (scoped)                   |
| 6   | **P1**   | **Receptionist** | `src/components/calendar/booking-modal.tsx`                   | RECEPTIONIST           | Scope provider dropdown to assigned providers; auto-select if only one; overlap detection                                                                                                                                                       | `getAssignedProviders`, `getAppointments`                            |
| 7   | P2       | **Receptionist** | `src/components/patients/add-patient-dialog.tsx` (new/update) | RECEPTIONIST           | Create patient with auto-generated username; show `Clinic@123` default password in success banner                                                                                                                                               | `createPatient`                                                      |
| 8   | P2       | **Receptionist** | `src/components/patients/patient-provider-link.tsx` (new)     | RECEPTIONIST           | Select patient → select assigned provider → link; show linked pairs with unlink button                                                                                                                                                          | `linkPatientToProvider`, `unlinkPatientProvider`                     |
| 9   | P2       | **Receptionist** | `src/app/dashboard/patients/page.tsx`                         | RECEPTIONIST           | Search by name/email/username; show linked providers per patient; quick-link action                                                                                                                                                             | `listPatients` (extended)                                            |
| 10  | P2       | **Receptionist** | `src/app/dashboard/patients/[id]/page.tsx`                    | RECEPTIONIST           | Patient detail with "Linked Doctors" section; notes edit; appointment history                                                                                                                                                                   | `getPatient`, `updatePatient`                                        |
| 11  | P2       | **Provider**     | `src/components/provider/working-hours-editor.tsx` (new)      | PROVIDER               | 7-day grid (Sun–Sat) with active toggle, start/end time; save via server action                                                                                                                                                                 | `upsertWorkingHours`                                                 |
| 12  | P2       | **Provider**     | `src/app/dashboard/provider/hours/page.tsx` (new)             | PROVIDER               | Working Hours page wrapping the editor component                                                                                                                                                                                                | `getWorkingHours`, `upsertWorkingHours`                              |
| 13  | P2       | **Provider**     | `src/components/provider/leave-request-form.tsx` (new)        | PROVIDER               | Date picker, reason, submit; shows own PENDING/APPROVED/REJECTED leaves                                                                                                                                                                         | `createLeaveRequest`, `getLeaveRequests`                             |
| 14  | P2       | **Provider**     | `src/app/dashboard/provider/leaves/page.tsx` (new)            | PROVIDER               | Leave requests page wrapping form + list                                                                                                                                                                                                        | `getLeaveRequests`                                                   |
| 15  | P2       | **Provider**     | `src/components/provider/notify-receptionist.tsx` (new)       | PROVIDER               | Select receptionist (from assignments), optional message, send notification                                                                                                                                                                     | `sendNotification`, `getAssignedReceptionists`                       |
| 16  | **P1**   | **Provider**     | `src/app/dashboard/calendar/page.tsx`                         | PROVIDER               | Filter to own appointments; shade working hours; block leave days                                                                                                                                                                               | `getAppointments` (scoped)                                           |
| 17  | P2       | **Patient**      | `src/app/dashboard/page.tsx`                                  | PATIENT                | Upcoming appointments card; quick "Book Appointment" button; linked doctors list                                                                                                                                                                | `getMyAppointments`, `getLinkedProviders`                            |
| 18  | P2       | **Patient**      | `src/components/patients/link-by-username.tsx` (new)          | PATIENT                | Input doctor's username → search → link; show "My Doctors" with unlink                                                                                                                                                                          | `linkPatientToProviderByUsername`                                    |
| 19  | P2       | **Patient**      | `src/components/calendar/booking-modal.tsx`                   | PATIENT                | Scope provider dropdown to linked providers only; auto-select if one                                                                                                                                                                            | `getLinkedProviders`                                                 |
| 20  | P2       | **Patient**      | `src/app/dashboard/appointments/page.tsx`                     | PATIENT                | Past appointment history; status, color, read-only detail                                                                                                                                                                                       | `getMyAppointments`                                                  |

---

> **Goal**: Build all user-facing interfaces and business-logic workflows on top of the Phase 1 database schema.
> **Principle**: Every UI change must respect RBAC. No component shows data or actions the current role cannot access.

---

## Table of Contents

1. [Settings & Profile Module (Global)](#1-settings--profile-module-global)
2. [Receptionist Workflows (The Core Engine)](#2-receptionist-workflows-the-core-engine)
3. [Provider (Doctor) Workflows](#3-provider-doctor-workflows)
4. [Patient Workflows](#4-patient-workflows)
5. [Cross-Cutting Concerns](#5-cross-cutting-concerns)
6. [Implementation Order](#6-implementation-order)

---

## 1. Settings & Profile Module (Global)

### 1.1 Personal Profile (All Roles)

- [ ] Create reusable `ProfileForm` component (`src/components/settings/profile-form.tsx`)
  - Fields: Name, Email, Username (pre-filled from `session.user`)
  - Validation: Zod schema (name required, email valid, username 3-30 chars unique)
  - Server action: `updateProfile` already exists in `settings.ts`
  - States: loading spinner on submit, inline field errors, success toast
- [ ] Ensure `updateProfile` returns the updated user so `session.update()` can refresh the client

### 1.2 Password Change (All Roles)

- [ ] Create reusable `PasswordForm` component (`src/components/settings/password-form.tsx`)
  - Fields: Current Password, New Password, Confirm New Password
  - Server action: `changePassword` already exists in `settings.ts`
  - Client-side: show password strength indicator (optional)
- [ ] On success: clear form, toast, optionally force re-login prompt

### 1.3 Admin User Management (ADMIN only)

- [ ] Build `AdminUserPanel` component (`src/components/settings/admin-user-panel.tsx`)
  - Fetch all users via `listUsers` server action (already exists)
  - Select dropdown with search/filter by name, email, or role
  - Inline password reset field with "Reset" button wired to `updateUserPassword`
  - Display user meta: name, email, username, role, created date

---

## 2. Receptionist Workflows (The Core Engine)

### 2.1 Provider-Scoped Calendar View

- [x] Update `src/app/dashboard/calendar/page.tsx` (or create a receptionist-specific page)
  - When `session.user.role === "RECEPTIONIST"`, fetch the receptionist's assigned providers (`ProviderAssignment` table)
  - Filter the calendar/appointments query to only show appointments belonging to those assigned providers
  - Add a provider filter chip bar so the receptionist can toggle which assigned provider's schedule to view

### 2.2 Appointment Scheduling (Scoped)

- [x] Update `BookingModal` to scope the Provider dropdown to the receptionist's assigned providers only
- [x] Hide the Provider dropdown entirely if the receptionist only has one assigned provider (auto-select)
- [x] Ensure overlap detection still respects provider-level constraints

### 2.3 Patient Management

- [x] Update `AddPatientDialog` / patient creation flow
  - Pre-fill `username` field (auto-generate from email or first name if not provided)
  - On create: save user with hashed `Clinic@123` default password
  - Show the auto-generated credentials in a success banner so the receptionist can hand them to the patient
- [x] Patient search: allow searching by name, email, or username

### 2.4 Linking Patients to Providers

- [x] Create `PatientProviderLink` component (built into `/dashboard/patients` page)
  - Form: select a patient → select an assigned provider → link
  - Server action: `linkPatientToProvider(patientId, providerId)` creating a `PatientProvider` row
  - Show existing linked pairs and an "unlink" button
- [ ] Add a "Linked Doctors" section to the Patient detail/edit view (detail page not yet updated)

### 2.5 Receptionist Notifications

- [ ] Add a notification badge/panel to the sidebar or header for receptionists
  - Poll/fetch notifications where `receiverId === session.user.id` and `status === "UNREAD"`
  - Display notification type, message, and "Action" button when applicable (e.g., "Reschedule appointments for Dr. X on Y date")

---

## 3. Provider (Doctor) Workflows

### 3.1 Working Hours UI

- [x] Create `WorkingHoursEditor` component (built into `/dashboard/availability`)
  - 7 rows (Sun–Sat), each with: active toggle, start time (HH:mm), end time (HH:mm)
  - Pre-fill from `WorkingHours` table for the current provider's `Provider.id`
  - Server action: `upsertWorkingHours(providerId, hours[])` — upserts by `[providerId, dayOfWeek]`
- [x] Add a "Working Hours" page for Providers (`/dashboard/availability`)

### 3.2 Leave Management

- [x] Create `LeaveRequestForm` component (built into `/dashboard/availability`)
  - Date picker, reason textarea, submit button
  - Server action: `createLeaveRequest(providerId, date, reason)` inserts into `LeaveRequest`
- [x] Create `LeaveRequestList` component to show past/upcoming requests and their status (PENDING / APPROVED / REJECTED)
- [x] Add a "Leave Requests" page for Providers (`/dashboard/availability`)

### 3.3 Notification to Receptionist

- [ ] Create `NotifyReceptionistButton` component
  - When pressed, opens a dialog: select receptionist (from `ProviderAssignment`), optional message, optional linked leave date
  - Server action: `sendNotification(senderId, receiverId, type, message, relatedEntityId?)`
  - On successful notification, show confirmation and optionally trigger an email/webhook

### 3.4 View Own Schedule

- [x] Calendar view for Provider: filter to `providerId === session.user.provider.id`
- [ ] Show working hours as shaded areas on the week view
- [ ] Show leave days as blocked/highlighted on the calendar

---

## 4. Patient Workflows

### 4.1 Patient Dashboard

- [ ] Create `PatientDashboard` component (`/dashboard` or `/dashboard/patient`)
  - Upcoming appointments list with status, provider name, date/time
  - Show "Reschedule Reason" if present in notes (parsed from `notes` field after `Rescheduled:` marker)
  - Quick action: "Book Appointment" (opens BookingModal scoped to their linked providers)

### 4.2 Provider Linking via Username

- [ ] Create `LinkProviderByUsername` component
  - Input: doctor's username
  - On submit: look up User by username → check role is PROVIDER → create `PatientProvider` link
  - Show "My Doctors" list with unlink option
  - Server action: `linkPatientToProviderByUsername(patientId, username)`
- [ ] Add username display to Provider profile cards so patients can easily share/find their doctor

### 4.3 Appointment History

- [ ] Show past appointments with status, notes, and color indicator
- [ ] Allow patients to view but not edit past appointment details

---

## 5. Cross-Cutting Concerns

### 5.1 RBAC Enforcement in UI

- [ ] Create a `<RoleGuard allowedRoles={[...]}>` wrapper component that hides children when the user lacks the required role
- [ ] Audit every new page/component to ensure role checks exist on both client (UI hide) and server (action guard)

### 5.2 Navigation / Sidebar Updates

- [ ] Update `src/components/layout/sidebar.tsx` to show role-appropriate nav items:
  | Item           | ADMIN | RECEPTIONIST | PROVIDER | PATIENT |
  | -------------- | ----- | ------------ | -------- | ------- |
  | Calendar       | ✓     | ✓ (scoped)   | ✓ (own)  | ✓       |
  | Appointments   | ✓     | ✓            | ✓        | ✓       |
  | Patients       | ✓     | ✓            | ✓        | ✗       |
  | Providers      | ✓     | ✗            | ✗        | ✗       |
  | Working Hours  | ✗     | ✗            | ✓        | ✗       |
  | Leave Requests | ✗     | ✗            | ✓        | ✗       |
  | Settings       | ✓     | ✓            | ✓        | ✓       |

### 5.3 Notification Badge

- [ ] Add a global notification bell icon in the header (visible to RECEPTIONIST and PROVIDER)
  - Fetch `Notification` count where `receiverId === session.user.id` and `status === "UNREAD"`
  - Dropdown panel with recent notifications and mark-as-read action

### 5.4 Error & Empty States

- [ ] Every list/table component must handle: loading skeleton, empty state message, error alert with retry
- [ ] Every form must handle: field-level validation errors, server error banner, loading submit button state

---

## 6. Implementation Order

| Priority | Module                       | Depends On     | Estimated Files               |
| -------- | ---------------------------- | -------------- | ----------------------------- |
| P1       | 2.1 Scoped Calendar          | Phase 1 schema | 3 (page, query, modal update) |
| P1       | 2.2 Scoped Scheduling        | 2.1            | 1 (modal update)              |
| P1       | 3.4 View Own Schedule        | 3.1            | 1 (page filter)               |
| P2       | 1.1 Profile Form             | Phase 1 schema | 2 (component + action update) |
| P2       | 1.2 Password Change          | Phase 1 schema | 2 (component + action)        |
| P2       | 1.3 Admin User Panel         | 1.1, 1.2       | 2 (component + action)        |
| P2       | 2.3 Patient Management       | 1.1            | 3 (dialog, action, query)     |
| P2       | 2.4 Patient-Provider Linking | 2.3            | 3 (component, action, query)  |
| P2       | 3.1 Working Hours UI         | —              | 3 (component, action, page)   |
| P2       | 3.2 Leave Management         | —              | 3 (form, list, action, page)  |
| P2       | 4.1 Patient Dashboard        | —              | 2 (page, component)           |
| P2       | 4.2 Provider Linking         | 4.1            | 2 (component, action)         |
| P2       | 4.3 Appointment History      | 4.1            | 1 (component)                 |
| P2       | 5.1 RoleGuard                | —              | 1 (component)                 |
| P2       | 5.2 Sidebar update           | —              | 1 (layout)                    |
| P3       | 3.3 Notify Receptionist      | 3.2, 5.3       | 2 (component, action)         |
| P3       | 5.3 Notification Badge       | 3.3            | 2 (component, action)         |
| P3       | 5.4 Error states audit       | All above      | N/A (fix as encountered)      |

---

> **Next**: Once this plan is approved, we will implement each priority group in order, starting with P0 items.
