# Phase 6: Web UI Two-Way Negotiation Flow

## Objective

Implement the patient-facing UI for responding to modified booking requests. When a receptionist modifies a request (status → `AWAITING_PATIENT_REPLY`), the patient can Accept the new time or Propose a Different Time from their calendar.

## Current State

- `getTentativeBookings()` already returns `AWAITING_PATIENT_REPLY` bookings to patients (filtered by `patientId`)
- Calendar views (month/week/day) already render these with blue dashed borders
- `TentativeBookingModal` is read-only — shows details + "Go to Requests" link (useless for patients)
- `approveBookingRequest` exists for receptionists — we replicate its pattern for patient acceptance
- `modifyBookingRequest` exists for receptionists — we create a patient variant that reverts to `PENDING`
- Schema already has `modifiedStart`, `modifiedEnd`, `status` fields on `BookingRequest`

---

## Rule File Mapping

| Checklist Item            | Rule File(s)           | Rule Reference                                                      |
| ------------------------- | ---------------------- | ------------------------------------------------------------------- |
| All `.tsx` components     | `rules/react.mdc`      | Functional components, hooks, forms, error handling, accessibility  |
| All `.ts` server actions  | `rules/nextjs.mdc`     | Zod validation, server-side validation, loading states              |
| All Prisma/schema changes | `rules/postgresql.mdc` | TIMESTAMPTZ, UUID, FK behavior, parameterized queries               |
| File organization         | `rules/nextjs.mdc`     | App Router structure, components in `components/`, shared in `lib/` |

---

## Implementation Steps

### Step 1: Add Server Actions — `patientAcceptBooking` and `patientRescheduleBooking`

**File:** `src/server/actions/booking-requests.ts`

**Rules:** `rules/react.mdc` (hooks, error handling), `rules/nextjs.mdc` (Zod validation, server-side validation), `rules/postgresql.mdc` (parameterized queries, FK behavior)

#### 1a. `patientAcceptBooking(id: string)`

```
- "use server" already at top of file
- Auth check: session.user.role === "PATIENT"
- Derive patient from session: db.patient.findUnique({ where: { userId: session.user.id } })
- Validate input: z.object({ id: z.string().uuid() })
- Fetch BookingRequest with provider include
  - Guard: request exists, status === "AWAITING_PATIENT_REPLY", patientId matches session patient
- Compute startTime = request.modifiedStart ?? request.requestedDate
- Compute endTime = request.modifiedEnd ?? (requestedDate + durationMinutes * 60000)
- Overlap check: db.appointment.findFirst (same as approveBookingRequest pattern)
- Create Appointment: status "SCHEDULED", title "Web booking — {patientPhone}"
- Update BookingRequest: status "APPROVED", appointmentId = appointment.id
- revalidatePath("/dashboard/calendar")
- return { success: true, data: { appointmentId } }
```

#### 1b. `patientRescheduleBooking(id: string, newStart: Date, newEnd: Date)`

```
- Auth check: session.user.role === "PATIENT"
- Derive patient from session
- Validate input: z.object({ id, newStart: z.coerce.date(), newEnd: z.coerce.date() })
- Fetch BookingRequest with provider include
  - Guard: request exists, status === "AWAITING_PATIENT_REPLY", patientId matches
- Validate newStart < newEnd
- Overlap check: db.appointment.findFirst (same pattern)
- Update BookingRequest:
  - status: "PENDING"  (reverts to receptionist queue)
  - modifiedStart: newStart
  - modifiedEnd: newEnd
  - Clear any previous modified data
- revalidatePath("/dashboard/calendar")
- revalidatePath("/dashboard/receptionist/requests")
- return { success: true }
```

**Zod schemas to add** (next to existing `approveSchema`, `modifySchema`):

```
patientAcceptSchema = z.object({ id: z.string().uuid() })
patientRescheduleSchema = z.object({ id: z.string().uuid(), newStart: z.coerce.date(), newEnd: z.coerce.date() })
```

---

### Step 2: Create Patient Response Modal Component

**File:** `src/components/calendar/patient-response-modal.tsx` (new file)

**Rules:** `rules/react.mdc` (functional component, hooks, forms, error handling, accessibility), `rules/nextjs.mdc` (Zod validation, loading states)

#### Component Structure

```
PatientResponseModal
├── Dialog wrapper (existing @/components/ui/dialog)
├── DialogHeader: title "Action Required — Modified Appointment"
├── Status banner: blue/amber styled Badge showing "New Time Proposed"
├── Proposed time card:
│   ├── Provider name
│   ├── Original requested time (if different from proposed)
│   └── NEW proposed time (from modifiedStart/modifiedEnd)
├── Action buttons:
│   ├── "Accept New Time" (primary, calls patientAcceptBooking)
│   └── "Propose Different Time" (outline, opens inline form)
├── Reschedule form (conditionally rendered):
│   ├── Date picker (input type="date")
│   ├── Time picker (input type="time")
│   ├── End time (auto-calculated from durationMinutes)
│   ├── "Submit New Time" button (calls patientRescheduleBooking)
│   └── "Cancel" button
└── Error display area (toast + inline error)
```

#### Props

```typescript
interface PatientResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: TentativeBooking | null;
}
```

#### Key Implementation Details

- Use `useSession()` to get role — only show Accept/Reschedule for PATIENT role
- Use `useQueryClient()` for cache invalidation after actions
- Use `useToast()` for success/error feedback
- Form state via `useState` (simple form, no react-hook-form needed)
- Time inputs: use HTML `<input type="date">` and `<input type="time">` with local timezone handling
- `onSuccess` callback: invalidate `["appointments"]`, `["tentativeBookings"]`, then close modal
- Loading states: disable buttons + show `Loader2` spinner during submission
- Accessibility: proper `aria-label` on buttons, semantic headings

---

### Step 3: Update TentativeBookingModal for Patient Role

**File:** `src/components/calendar/tentative-booking-modal.tsx`

**Rules:** `rules/react.mdc` (composition, props), `rules/nextjs.mdc` (role-based rendering)

#### Changes

- Import `useSession` from `next-auth/react`
- Get `role` from session
- Conditionally render different footer based on role:
  - **PATIENT + AWAITING_PATIENT_REPLY**: Show "Accept New Time" and "Propose Different Time" buttons (open `PatientResponseModal`)
  - **PATIENT + PENDING**: Show read-only "Pending — waiting for review" message (no action buttons)
  - **RECEPTIONIST/ADMIN**: Keep existing "Go to Requests" link
- Pass `PatientResponseModal` as a child component, controlled by local state

---

### Step 4: Add "Action Required" Banner on Patient Calendar

**File:** `src/app/dashboard/calendar/page.tsx`

**Rules:** `rules/react.mdc` (hooks, memoization), `rules/nextjs.mdc` (loading states, error handling)

#### Changes

- Filter `tentativeBookings` for `status === "AWAITING_PATIENT_REPLY"` using `useMemo`
- Render a prominent banner above the calendar when count > 0:
  ```
  ┌─────────────────────────────────────────────────┐
  │ ⚠ Action Required — {count} appointment(s)     │
  │ need your response. Click the blue blocks below.│
  └─────────────────────────────────────────────────┘
  ```
- Style: amber/blue border, `AlertCircle` icon from lucide-react
- Only visible when `role === "PATIENT"`

---

### Step 5: Enhance Calendar Legend for Patient View

**File:** `src/app/dashboard/calendar/page.tsx`

**Rules:** `rules/react.mdc` (accessibility), `rules/nextjs.mdc` (role-based rendering)

#### Changes

- Add a legend entry for `AWAITING_PATIENT_REPLY` when role is PATIENT:
  ```
  <span className="size-3 rounded border-2 border-dashed border-blue-400 bg-blue-50" />
  <span>Action Required (click to respond)</span>
  ```
- This is already partially there — just make the label more actionable for patients

---

### Step 6: Cache Invalidation Wiring

**Files:** `src/server/actions/booking-requests.ts`, `src/components/calendar/patient-response-modal.tsx`

**Rules:** `rules/nextjs.mdc` (caching strategies), `rules/react.mdc` (state management)

#### Server-side (revalidatePath)

Both `patientAcceptBooking` and `patientRescheduleBooking` must call:

```
revalidatePath("/dashboard/calendar")
```

`patientRescheduleBooking` additionally calls:

```
revalidatePath("/dashboard/receptionist/requests")
```

#### Client-side (React Query)

After successful action in `PatientResponseModal`:

```
queryClient.invalidateQueries({ queryKey: ["appointments"] })
queryClient.invalidateQueries({ queryKey: ["tentativeBookings"] })
queryClient.invalidateQueries({ queryKey: ["bookingRequests"] })  // for receptionist page
```

---

## Files Changed Summary

| File                                                  | Action     | Description                                                                   |
| ----------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `src/server/actions/booking-requests.ts`              | Modify     | Add `patientAcceptBooking`, `patientRescheduleBooking`, and their Zod schemas |
| `src/components/calendar/patient-response-modal.tsx`  | **Create** | New modal: Accept or Propose Different Time                                   |
| `src/components/calendar/tentative-booking-modal.tsx` | Modify     | Role-based footer: patient gets Accept/Reschedule buttons                     |
| `src/app/dashboard/calendar/page.tsx`                 | Modify     | "Action Required" banner + enhanced legend                                    |

---

## Verification Checklist

1. `npx tsc --noEmit` — zero errors
2. `npm run lint` — zero new errors
3. Patient calendar shows "Action Required" banner when AWAITING_PATIENT_REPLY bookings exist
4. Clicking blue dashed block opens `TentativeBookingModal` with Accept/Reschedule buttons
5. "Accept New Time" → creates SCHEDULED appointment, removes dashed block, shows solid block
6. "Propose Different Time" → shows date/time picker → submits → reverts to PENDING (amber dashed block)
7. Receptionist page shows the reverted request in queue
8. Overlap check prevents double-booking
9. Only the owning patient can accept/reschedule (RBAC enforced server-side)
10. All cache invalidations fire correctly (no stale data)
