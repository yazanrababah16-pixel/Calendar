# Features Log — Calendar App

## Tech Stack

| Layer          | Technology                       |
| -------------- | -------------------------------- |
| Framework      | Next.js 16 (App Router)          |
| Language       | TypeScript                       |
| Database       | PostgreSQL via Neon              |
| ORM            | Prisma                           |
| Auth           | Auth.js v5 (JWT strategy)        |
| Validation     | Zod v4                           |
| Styling        | Tailwind CSS v4                  |
| UI Components  | shadcn/ui (Radix Primitives)     |
| State (Server) | TanStack Query v5                |
| State (Client) | React `useState` / `useCallback` |
| Scheduling     | date-fns                         |
| Hashing        | bcrypt                           |

---

## Role-Based Access Control (RBAC)

### Roles

| Role           | Description                                                      |
| -------------- | ---------------------------------------------------------------- |
| `ADMIN`        | Full access — manage providers, patients, appointments, settings |
| `PROVIDER`     | View own schedule, manage own appointments and patients          |
| `RECEPTIONIST` | Manage all appointments and patients, no provider management     |
| `PATIENT`      | View own appointments and profile only                           |

### Implementation

- **Middleware** (`src/proxy.ts`): Wraps Auth.js middleware. On each request, checks `req.auth.user.role` against a role-route map. If the user's role lacks permission for the path, redirects to their allowed dashboard.
- **API routes**: Server-side check via `auth()`. Returns `401 Unauthorized` if no session.
- **Server actions**: Check `session.user.role` before mutating data (e.g., `createProvider` requires `ADMIN`).
- **Sidebar** (`src/components/layout/sidebar.tsx`): Dynamically renders nav items based on user role (providers, patients, appointments, calendar, settings).

### Route Permissions

| Route                     | Allowed Roles                 |
| ------------------------- | ----------------------------- |
| `/dashboard`              | All                           |
| `/dashboard/calendar`     | All                           |
| `/dashboard/appointments` | All                           |
| `/dashboard/patients`     | ADMIN, PROVIDER, RECEPTIONIST |
| `/dashboard/providers`    | ADMIN, PROVIDER, RECEPTIONIST |
| `/dashboard/settings`     | All                           |

---

## Database Architecture

### Key Models

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  password  String?
  role      Role      @default(PATIENT)
  image     String?
  provider  Provider?
  patient   Patient?
  createdAt DateTime  @default(now())
}

model Provider {
  id        String       @id @default(cuid())
  userId    String       @unique
  user      User         @relation(fields: [userId], references: [id])
  specialty String?
  phone     String?
  bio       String?
  isActive  Boolean      @default(true)
  appointments Appointment[]
  createdAt DateTime     @default(now())
}

model Patient {
  id        String       @id @default(cuid())
  userId    String       @unique
  user      User         @relation(fields: [userId], references: [id])
  phone     String?
  dateOfBirth DateTime?
  appointments Appointment[]
  createdAt DateTime     @default(now())
}

model Appointment {
  id         String            @id @default(cuid())
  title      String?
  notes      String?
  color      String?           @default("#3b82f6")
  status     AppointmentStatus @default(SCHEDULED)
  startTime  DateTime
  endTime    DateTime
  providerId String
  provider   Provider          @relation(fields: [providerId], references: [id])
  patientId  String
  patient    Patient           @relation(fields: [patientId], references: [id])
  createdAt  DateTime          @default(now())
}
```

### Relationships

- **User ↔ Provider**: One-to-one (User has optional Provider, Provider has one User)
- **User ↔ Patient**: One-to-one (User has optional Patient, Patient has one User)
- **Provider ↔ Appointment**: One-to-many
- **Patient ↔ Appointment**: One-to-many

---

## Calendar Module

### Week View (24-Hour Range)

- **File**: `src/components/calendar/week-view.tsx`
- **Renders**: 7-day grid (Mon–Sun) with 24 hourly rows (00:00–23:59)
- **Hours array**: `Array.from({ length: 24 }, (_, i) => i)` — midnight to 11 PM
- **Appointment display**: Color-coded by status (`SCHEDULED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`)
- **Interactions**:
  - Click an empty slot → opens booking modal
  - Click an appointment → opens appointment detail / edit modal

### Month View

- **File**: `src/components/calendar/month-view.tsx`
- **Renders**: Standard month grid with date cells
- **Appointments shown as dots** below each day number

### Appointments

- **CRUD**: Create (via booking modal), Read (list in week/month view), Update (reschedule), Delete (cancel)
- **Validation**: Zod schemas enforce required fields, date ordering (`startTime < endTime`), and overlap detection
- **Overlap prevention**: Server-side check before creation — blocks if the provider already has a non-cancelled appointment in the requested time slot

---

## API Routes

| Route               | Method | Purpose                                                                                     |
| ------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `/api/providers`    | GET    | List providers (filterable by `isActive`, `specialty`)                                      |
| `/api/appointments` | GET    | List appointments (filterable by `providerId`, `patientId`, `dateFrom`, `dateTo`, `status`) |
| `/api/appointments` | POST   | Create a new appointment with overlap detection                                             |

All API routes require authentication. Query parameters use `?? undefined` to prevent Zod validation failures on missing optional params.

---

## Color-Coded Calendar & Appointment Management

### Database

- **Field added**: `color String? @default("#3b82f6")` on the `Appointment` model
- **Migration**: `prisma/migrations/20260720085954_add_color_to_appointment`
- **Default color**: Blue (`#3b82f6`) — applied to new appointments if no color is specified

### View/Edit Modal (`src/components/calendar/booking-modal.tsx`)

When clicking an existing appointment on the calendar, a detailed View/Edit modal opens with:

- **Read-only Details section**: Shows Patient Name, Provider Name, Date/Time, Title, Notes, and current color swatch
- **Reschedule button**: Opens the form with date/time fields editable, retains patient/provider/notes
- **Edit Details button**: Opens the form with notes/color fields editable, retains patient/provider/times
- **Delete Appointment**: Permanent removal
- **Cancel Appointment**: Status change to `CANCELLED`
- **Color picker**: 10 preset color circles (Blue, Green, Red, Yellow, Purple, Pink, Orange, Teal, Gray, Indigo) with visual selection state

### Calendar Event Rendering

- **Week View** (`src/components/calendar/week-view.tsx`): Events display with the appointment's `color` as a semi-transparent background and solid left border. Falls back to status-based coloring if no color is set.
- **Month View** (`src/components/calendar/month-view.tsx`): Appointment dots use the `color` value as their background. Falls back to status-based dot color if no color is set.

### Server Actions & Validation

- **Zod schemas** (`src/lib/schemas/appointment.ts`): Both `createAppointmentSchema` and `updateAppointmentSchema` accept an optional `color` field validated as a hex color string (`/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/`)
- **Server actions** (`src/server/actions/appointments.ts`): `bookAppointment` and `updateAppointment` read, validate, and persist the `color` value from the form data
- **API routes** (`src/app/api/appointments/route.ts`, `src/app/api/appointments/[id]/route.ts`): POST and PATCH endpoints accept and save the `color` field

### RBAC Compliance

- `ADMIN` and `RECEPTIONIST` can edit all fields (reschedule, details, color, cancel, delete)
- `PROVIDER` can view details (existing behavior preserved)
- `PATIENT` has read-only access (existing behavior preserved)
