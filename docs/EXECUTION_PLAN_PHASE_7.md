# Execution Plan — Phase 7: Notification Center & Patient Reschedule Request

**Date:** 2026-07-27
**Status:** Approved & Executing

---

## Goal

- **Notification Center**: Unify notification bell for ALL roles (patients, providers, receptionists, admins) in the dashboard header.
- **Patient Reschedule Request**: Allow patients to proactively request rescheduling of an existing appointment, notifying staff.

---

## Database Schema Changes

### 1. AppointmentStatus enum — Add `RESCHEDULE_REQUESTED`

```prisma
enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
  NEEDS_RESCHEDULE
  RESCHEDULE_REQUESTED   # ← NEW: Patient-initiated reschedule request
}
```

### 2. Push to Neon

```
npx prisma db push
```

---

## Server Actions

### 3. `patientRequestReschedule` (in `src/server/actions/appointments.ts`)

- Input: `appointmentId: string`
- Validates: session is PATIENT, owns the appointment, status is SCHEDULED/CONFIRMED
- Sets appointment status → `RESCHEDULE_REQUESTED`
- Creates Notification for all RECEPTIONIST/ADMIN users
- Revalidates `/dashboard`, `/dashboard/calendar`

### 4. Notification creation pattern (already exists in `booking-requests.ts`)

```ts
db.notification.createMany({
  data: staff.map((s) => ({
    type: "patient_reschedule_request",
    message: `<patientName> requested rescheduling for <date>.`,
    senderId: session.user.id,
    receiverId: s.id,
    relatedEntityId: appointmentId,
    relatedEntityType: "appointment",
  })),
});
```

---

## UI Components

### 5. NotificationBell — Enable for PATIENT role

**File:** `src/components/notifications/notification-bell.tsx`

- Remove role gate that restricts to `["RECEPTIONIST", "PROVIDER", "ADMIN"]`
- Add patient-specific notification routing: `patient_reschedule_request` → `/dashboard`

### 6. Patient Dashboard — "Request Reschedule" button

**File:** `src/app/dashboard/page.tsx` (`PatientDashboard`)

- Add a button next to each SCHEDULED/CONFIRMED appointment
- On click: confirm dialog → call `patientRequestReschedule(appointmentId)` → toast success → refresh

### 7. Patient Calendar — "Request Reschedule" button

**File:** `src/app/dashboard/calendar/page.tsx`

- After the Action Required banner, add a secondary button or inline action on SCHEDULED/CONFIRMED appointments
- Use the same `patientRequestReschedule` action

---

## Cache Invalidation

### 8. After `patientRequestReschedule`

- `revalidatePath("/dashboard")`
- `revalidatePath("/dashboard/calendar")`
- Client-side: `queryClient.invalidateQueries({ queryKey: ["appointments"] })`
- Client-side: `queryClient.invalidateQueries({ queryKey: ["unreadCount"] })`

---

## Files Changed (Summary)

| File                                                 | Change                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `prisma/schema.prisma`                               | Add `RESCHEDULE_REQUESTED` to `AppointmentStatus`                |
| `src/server/actions/appointments.ts`                 | Add `patientRequestReschedule` action                            |
| `src/components/notifications/notification-bell.tsx` | Remove role gate, add patient routing                            |
| `src/app/dashboard/page.tsx`                         | Add "Request Reschedule" button to patient upcoming appointments |
| `src/app/dashboard/calendar/page.tsx`                | Add "Request Reschedule" inline action                           |
| `docs/EXECUTION_PLAN_PHASE_7.md`                     | This file                                                        |

---

## Testing

1. Login as PATIENT → see notification bell with unread count
2. Login as PATIENT → navigate to dashboard → click "Request Reschedule" on upcoming appointment
3. Verify appointment status changes to `RESCHEDULE_REQUESTED`
4. Verify RECEPTIONIST/ADMIN see notification in bell dropdown
5. Verify calendar page updates without full reload
