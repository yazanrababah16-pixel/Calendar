# Phase 2: UI & Workflows — Execution Plan

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

- [ ] Update `src/app/dashboard/calendar/page.tsx` (or create a receptionist-specific page)
  - When `session.user.role === "RECEPTIONIST"`, fetch the receptionist's assigned providers (`ProviderAssignment` table)
  - Filter the calendar/appointments query to only show appointments belonging to those assigned providers
  - Add a provider filter chip bar so the receptionist can toggle which assigned provider's schedule to view

### 2.2 Appointment Scheduling (Scoped)

- [ ] Update `BookingModal` to scope the Provider dropdown to the receptionist's assigned providers only
- [ ] Hide the Provider dropdown entirely if the receptionist only has one assigned provider (auto-select)
- [ ] Ensure overlap detection still respects provider-level constraints

### 2.3 Patient Management

- [ ] Update `AddPatientDialog` / patient creation flow
  - Pre-fill `username` field (auto-generate from email or first name if not provided)
  - On create: save user with hashed `Clinic@123` default password
  - Show the auto-generated credentials in a success banner so the receptionist can hand them to the patient
- [ ] Patient search: allow searching by name, email, or username

### 2.4 Linking Patients to Providers

- [ ] Create `PatientProviderLink` component (`src/components/patients/patient-provider-link.tsx`)
  - Form: select a patient → select an assigned provider → link
  - Server action: `linkPatientToProvider(patientId, providerId)` creating a `PatientProvider` row
  - Show existing linked pairs and an "unlink" button
- [ ] Add a "Linked Doctors" section to the Patient detail/edit view

### 2.5 Receptionist Notifications

- [ ] Add a notification badge/panel to the sidebar or header for receptionists
  - Poll/fetch notifications where `receiverId === session.user.id` and `status === "UNREAD"`
  - Display notification type, message, and "Action" button when applicable (e.g., "Reschedule appointments for Dr. X on Y date")

---

## 3. Provider (Doctor) Workflows

### 3.1 Working Hours UI

- [ ] Create `WorkingHoursEditor` component (`src/components/provider/working-hours-editor.tsx`)
  - 7 rows (Sun–Sat), each with: active toggle, start time (HH:mm), end time (HH:mm)
  - Pre-fill from `WorkingHours` table for the current provider's `Provider.id`
  - Server action: `upsertWorkingHours(providerId, hours[])` — upserts by `[providerId, dayOfWeek]`
- [ ] Add a "Working Hours" page or tab for Providers (`/dashboard/provider/hours` or a tab on calendar)

### 3.2 Leave Management

- [ ] Create `LeaveRequestForm` component (`src/components/provider/leave-request-form.tsx`)
  - Date picker, reason textarea, submit button
  - Server action: `createLeaveRequest(providerId, date, reason)` inserts into `LeaveRequest`
- [ ] Create `LeaveRequestList` component to show past/upcoming requests and their status (PENDING / APPROVED / REJECTED)
- [ ] Add a "Leave Requests" page for Providers (`/dashboard/provider/leaves`)

### 3.3 Notification to Receptionist

- [ ] Create `NotifyReceptionistButton` component
  - When pressed, opens a dialog: select receptionist (from `ProviderAssignment`), optional message, optional linked leave date
  - Server action: `sendNotification(senderId, receiverId, type, message, relatedEntityId?)`
  - On successful notification, show confirmation and optionally trigger an email/webhook

### 3.4 View Own Schedule

- [ ] Calendar view for Provider: filter to `providerId === session.user.provider.id`
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
| P0       | 1.1 Profile Form             | Phase 1 schema | 2 (component + action update) |
| P0       | 1.2 Password Change          | Phase 1 schema | 2 (component + action)        |
| P0       | 1.3 Admin User Panel         | 1.1, 1.2       | 2 (component + action)        |
| P0       | 2.1 Scoped Calendar          | 1.1            | 3 (page, query, modal update) |
| P0       | 2.2 Scoped Scheduling        | 2.1            | 1 (modal update)              |
| P1       | 2.3 Patient Management       | 1.1            | 3 (dialog, action, query)     |
| P1       | 2.4 Patient-Provider Linking | 2.3            | 3 (component, action, query)  |
| P1       | 3.1 Working Hours UI         | —              | 3 (component, action, page)   |
| P1       | 3.2 Leave Management         | —              | 3 (form, list, action, page)  |
| P2       | 3.3 Notify Receptionist      | 3.2, 5.3       | 2 (component, action)         |
| P2       | 4.1 Patient Dashboard        | —              | 2 (page, component)           |
| P2       | 4.2 Provider Linking         | 4.1            | 2 (component, action)         |
| P2       | 4.3 Appointment History      | 4.1            | 1 (component)                 |
| P2       | 5.1 RoleGuard                | —              | 1 (component)                 |
| P2       | 5.2 Sidebar update           | —              | 1 (layout)                    |
| P3       | 5.3 Notification Badge       | 3.3            | 2 (component, action)         |
| P3       | 5.4 Error states audit       | All above      | N/A (fix as encountered)      |

---

> **Next**: Once this plan is approved, we will implement each priority group in order, starting with P0 items.
