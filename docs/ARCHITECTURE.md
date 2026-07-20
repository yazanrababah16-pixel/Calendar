# Architecture & Data Flow

## System Flow

```mermaid
flowchart TB
    subgraph Client [Next.js Client]
        A[Browser] --> B[NextAuth Session]
        B --> C[Role Guard]
        C --> D1[Receptionist Views]
        C --> D2[Provider Views]
        C --> D3[Patient Views]
        C --> D4[Admin Views]
    end

    subgraph Server [Server Actions / API]
        E[Server Actions] --> F[Auth Check]
        F --> G[Zod Validation]
        G --> H[Prisma ORM]
        H --> I[(PostgreSQL)]
    end

    subgraph External [External]
        J[n8n Webhook] --> K[WorkflowEvent]
        L[Email / SMS] --> J
    end

    D1 --> E
    D2 --> E
    D3 --> E
    D4 --> E
    K --> H
```

## Role-Based Data Flow

### Receptionist Flow

```mermaid
flowchart LR
    A[Receptionist Logs In] --> B{Fetch assigned providers}
    B --> C[Calendar scoped to assignments]
    B --> D[Schedule appointment<br>with assigned provider]
    B --> E[Create patient<br>auto-gen username, default pw]
    B --> F[Link patient to provider]
    B --> G[View/search patients<br>by name/email/username]
    C --> H[Receive notifications<br>from providers]
    H --> I[Action: reschedule<br>on leave dates]
```

### Provider (Doctor) Flow

```mermaid
flowchart LR
    A[Provider Logs In] --> B[Set Working Hours]
    A --> C[Request Leave]
    A --> D[View Own Schedule]
    A --> E[Notify Receptionist]
    B --> F[Overlap detection<br>on appointment booking]
    C --> G[Receptionist notified<br>via Notification]
    D --> H[Calendar shows working hours<br>as shaded areas, leave as blocked]
```

### Patient Flow

```mermaid
flowchart LR
    A[Patient Logs In] --> B[Link to doctor<br>by username]
    A --> C[Book appointment<br>scoped to linked providers]
    A --> D[View upcoming appointments]
    A --> E[View appointment history]
    C --> F[Appointment created<br>with linked provider]
```

### Admin Override Flow

```mermaid
flowchart LR
    A[Admin Logs In] --> B[View all users]
    A --> C[Reset any user's password]
    B --> D[Search/filter by name,<br>email, role, username]
    C --> E[updateUserPassword action]
    E --> F[bcrypt hash → DB]
```

## Entity Relationship Diagram

```mermaid
erDiagram
    User {
        string id PK
        string email UK
        string username UK "nullable"
        string name
        enum role "ADMIN | PROVIDER | RECEPTIONIST | PATIENT"
        string image "nullable"
        string passwordHash "nullable"
        datetime createdAt
        datetime updatedAt
    }

    Patient {
        string id PK
        datetime dateOfBirth "nullable"
        string phone "nullable"
        string notes "nullable"
        datetime createdAt
        datetime updatedAt
        string userId FK, UK
    }

    Provider {
        string id PK
        string specialty "nullable"
        string phone "nullable"
        string bio "nullable"
        boolean isActive
        datetime createdAt
        datetime updatedAt
        string userId FK, UK
    }

    PatientProvider {
        string patientId PK, FK
        string providerId PK, FK
        datetime createdAt
    }

    ProviderAssignment {
        string id PK
        datetime createdAt
        string providerId FK
        string userId FK
    }

    WorkingHours {
        string id PK
        int dayOfWeek
        string startTime
        string endTime
        boolean isActive
        datetime createdAt
        datetime updatedAt
        string providerId FK
    }

    LeaveRequest {
        string id PK
        datetime date
        enum status "PENDING | APPROVED | REJECTED"
        string reason "nullable"
        datetime createdAt
        datetime updatedAt
        string providerId FK
    }

    Appointment {
        string id PK
        string title "nullable"
        string notes "nullable"
        string color "nullable"
        enum status "SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW"
        datetime startTime
        datetime endTime
        datetime createdAt
        datetime updatedAt
        string patientId FK
        string providerId FK
    }

    Availability {
        string id PK
        int dayOfWeek
        string startTime
        string endTime
        boolean isActive
        datetime createdAt
        datetime updatedAt
        string providerId FK
    }

    WorkflowEvent {
        string id PK
        string workflowType
        enum status "PENDING | PROCESSING | DELIVERED | FAILED"
        json payload "nullable"
        json result "nullable"
        string idempotencyKey UK
        string lastError "nullable"
        datetime createdAt
        datetime updatedAt
        string appointmentId FK "nullable"
    }

    Notification {
        string id PK
        string type
        string message "nullable"
        enum status "UNREAD | READ | ACTIONED"
        string relatedEntityId "nullable"
        string relatedEntityType "nullable"
        datetime createdAt
        datetime updatedAt
        string senderId FK
        string receiverId FK
    }

    User ||--o| Patient : "has one"
    User ||--o| Provider : "has one"
    User ||--o{ ProviderAssignment : "assigned to"
    User ||--o{ Notification : "sends"
    User ||--o{ Notification : "receives"

    Patient ||--o{ Appointment : "has"
    Patient ||--o{ PatientProvider : "linked to"

    Provider ||--o{ Appointment : "has"
    Provider ||--o{ PatientProvider : "linked to"
    Provider ||--o{ WorkingHours : "has"
    Provider ||--o{ LeaveRequest : "has"
    Provider ||--o{ Availability : "has"
    Provider ||--o{ ProviderAssignment : "assignment"

    Appointment ||--o{ WorkflowEvent : "triggers"
```

## Key Relationships

- **User → Patient**: 1:1 (via `userId` unique on Patient)
- **User → Provider**: 1:1 (via `userId` unique on Provider)
- **User → ProviderAssignment**: 1:N (a Provider can be assigned as a receptionist's provider)
- **Patient → Provider**: M:N through `PatientProvider`
- **Provider → WorkingHours**: 1:N (one per day of week)
- **Provider → LeaveRequest**: 1:N
- **Appointment → WorkflowEvent**: 1:N
- **User → Notification**: 1:N (as sender), 1:N (as receiver)

## RBAC Matrix

| Resource          | ADMIN | RECEPTIONIST    | PROVIDER       | PATIENT |
| ----------------- | ----- | --------------- | -------------- | ------- |
| View all users    | ✓     | ✗               | ✗              | ✗       |
| Reset passwords   | ✓     | ✗               | ✗              | ✗       |
| Calendar (scoped) | ✓     | ✓ assigned      | ✓ own          | ✓ own   |
| Appointments      | ✓     | ✓ all           | ✓ own          | ✓ own   |
| Patients          | ✓     | ✓ search/create | ✓ assigned     | ✗       |
| Providers         | ✓     | ✗               | ✗              | ✗       |
| Working Hours     | ✗     | ✗               | ✓ own          | ✗       |
| Leave Requests    | ✗     | ✗               | ✓ own          | ✗       |
| Settings          | ✓     | ✓               | ✓              | ✓       |
| Notifications     | ✗     | ✓ receive       | ✓ send/receive | ✗       |
