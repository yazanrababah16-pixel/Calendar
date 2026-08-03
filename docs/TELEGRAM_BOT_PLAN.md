# Telegram AI Bot — Execution Plan

## Overview

Transition the clinic's AI booking agent from WhatsApp to Telegram. This plan covers backend API changes, database schema updates, and n8n workflow duplication/modification.

---

## Phase 1: Environment Variables

### 1.1 Add to `.env`

```bash
# TELEGRAM
TELEGRAM_BOT_TOKEN=8861389339:AAGcubm_AJcu2QZZDP9FkQb5fW21XmBXQwI
```

### 1.2 Add to `.env.example`

```bash
# TELEGRAM (required for Telegram AI Bot)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

### Files to modify

| #   | File           | Change                                    |
| --- | -------------- | ----------------------------------------- |
| 1   | `.env`         | Add `TELEGRAM_BOT_TOKEN` line             |
| 2   | `.env.example` | Add `TELEGRAM_BOT_TOKEN` with placeholder |

---

## Phase 2: Database Schema — Link Telegram Chat ID to Patient

### 2.1 Add `telegramChatId` field to Patient model

**File:** `prisma/schema.prisma` — Patient model (line 90-108)

Add after the `phone` field:

```prisma
model Patient {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @unique @db.Uuid
  dateOfBirth     DateTime? @db.Date
  phone           String   @unique
  telegramChatId  String?  @unique   // <-- NEW: Telegram user chat ID
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  // ... relations unchanged
}
```

**Why `@unique`?** Each Telegram account maps to exactly one patient. Each patient has at most one Telegram account.

### 2.2 Create migration

```bash
npx prisma migrate dev --name add-telegram-chat-id
```

### 2.3 Regenerate Prisma client

```bash
npx prisma generate
```

### Files to modify

| #   | File                   | Change                                          |
| --- | ---------------------- | ----------------------------------------------- |
| 1   | `prisma/schema.prisma` | Add `telegramChatId String? @unique` to Patient |
| 2   | `prisma/migrations/`   | Auto-generated migration file                   |

---

## Phase 3: Backend API — Telegram Account Linking

### 3.1 New API endpoint: `POST /api/telegram/link-account`

**Purpose:** The n8n AI agent calls this endpoint to link a Telegram Chat ID to an existing patient record using their phone number.

**Flow:**

1. Telegram user sends first message to bot
2. n8n AI agent asks: "What is your registered phone number?"
3. User provides phone number
4. n8n calls `POST /api/telegram/link-account` with `{ phone, telegramChatId }`
5. Backend looks up `Patient` by `phone`, sets `telegramChatId`
6. Returns success or error

**Request body:**

```json
{
  "phone": "+962791234567",
  "telegramChatId": "123456789"
}
```

**Response (success):**

```json
{
  "success": true,
  "patientId": "uuid",
  "name": "Patient Name"
}
```

**Response (error cases):**

- `400` — Missing phone or telegramChatId
- `404` — No patient found with that phone number
- `409` — Telegram Chat ID already linked to a different patient
- `200` — Already linked (idempotent)

**File to create:** `src/app/api/telegram/link-account/route.ts`

**Implementation notes:**

- No auth required (called by n8n agent, not by a user session)
- Validate phone format (digits, spaces, dashes, plus)
- Use `upsert` pattern: if `telegramChatId` already set to this value, return success; if set to different value, return 409
- Log the linking event for audit

### 3.2 New API endpoint: `POST /api/telegram/identify`

**Purpose:** The n8n AI agent calls this to identify which patient is talking based on their Telegram Chat ID.

**Flow:**

1. Every incoming Telegram message carries `chat.id`
2. n8n calls `POST /api/telegram/identify` with `{ telegramChatId }`
3. Backend returns the patient record (or null if not linked)

**Request body:**

```json
{
  "telegramChatId": "123456789"
}
```

**Response (linked):**

```json
{
  "linked": true,
  "patientId": "uuid",
  "name": "Patient Name",
  "phone": "+962791234567"
}
```

**Response (not linked):**

```json
{
  "linked": false
}
```

**File to create:** `src/app/api/telegram/identify/route.ts`

**Implementation notes:**

- No auth required (called by n8n agent)
- Simple lookup: `Patient.findUnique({ where: { telegramChatId } })`
- Returns minimal data (no medical records, no other patients' data)

### 3.3 New AI tool: `get_my_appointments`

**Purpose:** Allow linked patients to view their own appointments via the Telegram bot.

**New endpoint:** `GET /api/telegram/my-appointments?telegramChatId=123456789`

**Response:**

```json
{
  "appointments": [
    {
      "id": "uuid",
      "startTime": "2026-08-05T10:00:00Z",
      "endTime": "2026-08-5T10:30:00Z",
      "providerName": "Dr. Sarah Smith",
      "status": "CONFIRMED"
    }
  ]
}
```

**File to create:** `src/app/api/telegram/my-appointments/route.ts`

**Implementation notes:**

- No auth required (called by n8n agent)
- Looks up patient by `telegramChatId`
- Returns only that patient's future appointments
- **Critical security:** Filter by `patientId` — never return other patients' data

### Files to create

| #   | File                                            | Purpose                                    |
| --- | ----------------------------------------------- | ------------------------------------------ |
| 1   | `src/app/api/telegram/link-account/route.ts`    | Link Telegram Chat ID to patient via phone |
| 2   | `src/app/api/telegram/identify/route.ts`        | Identify patient by Telegram Chat ID       |
| 3   | `src/app/api/telegram/my-appointments/route.ts` | Get patient's own appointments             |

---

## Phase 4: n8n Workflow — Duplicate & Modify

### 4.1 Duplicate the workflow file

**Source:** `C:\Users\yazan\OneDrive\Desktop\n8nflow\WhatsApp AI Booking Agent.json`
**Target:** `C:\Users\yazan\OneDrive\Desktop\n8nflow\Telegram AI Booking Agent.json`

Copy the file, then apply the following modifications.

### 4.2 Node-by-node changes

| #   | Original Node                                             | New Node                                                | Change                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **WhatsApp Webhook** (webhook, POST `/whatsapp-ai-agent`) | **Telegram Trigger** (`n8n-nodes-base.telegramTrigger`) | Replace webhook with Telegram Trigger node. Set `updates: ["message"]`. Uses `TELEGRAM_BOT_TOKEN` credential.                                                                                                                                                         |
| 2   | **Parse Incoming Message** (code)                         | **Parse Telegram Message** (code)                       | Rewrite JS to extract from Telegram update format: `$input.first().json.message.chat.id` → `telegramChatId`, `$input.first().json.message.from.first_name` → `patientName`, `$input.first().json.message.text` → `message`.                                           |
| 3   | **AI Agent** (langchain.agent)                            | **AI Agent** (no change)                                | Keep as-is. System prompt still loaded from `$env.AI_SYSTEM_PROMPT`.                                                                                                                                                                                                  |
| 4   | **Window Buffer Memory** (memoryBufferWindow)             | **Window Buffer Memory**                                | Change `sessionKey` from `conversationId` (phone-based) to `telegramChatId` (from parsed message).                                                                                                                                                                    |
| 5   | **List Providers Tool** (toolHttpRequest)                 | **List Providers Tool** (no change)                     | `GET /api/providers/active` — already public, works as-is.                                                                                                                                                                                                            |
| 6   | **Check Availability Tool** (toolHttpRequest)             | **Check Availability Tool** (no change)                 | `GET /api/availability/slots` — already public, works as-is.                                                                                                                                                                                                          |
| 7   | **Submit Booking Tool** (toolHttpRequest)                 | **Submit Booking Tool**                                 | Update `submit_booking` tool URL. Add new tool: **Identify Patient Tool** (`POST /api/telegram/identify`). Add new tool: **Link Account Tool** (`POST /api/telegram/link-account`). Add new tool: **Get My Appointments Tool** (`GET /api/telegram/my-appointments`). |
| 8   | **Respond to Webhook** (respondToWebhook)                 | **Send Telegram Message** (`n8n-nodes-base.telegram`)   | Replace webhook response with Telegram `sendMessage` node. Uses `TELEGRAM_BOT_TOKEN` credential. Chat ID from `$('Parse Telegram Message').item.json.telegramChatId`. Message from AI agent output.                                                                   |

### 4.3 New AI Tools to add

| #   | Tool Name             | Method | URL                             | Purpose                                       |
| --- | --------------------- | ------ | ------------------------------- | --------------------------------------------- |
| 1   | `identify_patient`    | POST   | `/api/telegram/identify`        | Check if Telegram user is linked to a patient |
| 2   | `link_account`        | POST   | `/api/telegram/link-account`    | Link Telegram Chat ID to patient via phone    |
| 3   | `get_my_appointments` | GET    | `/api/telegram/my-appointments` | Get linked patient's upcoming appointments    |

### 4.4 Updated connection flow

```
Telegram Trigger --> Parse Telegram Message --> AI Agent --> Send Telegram Message
                                                  |
                                    (sub-connections):
                                    Window Buffer Memory --> AI Agent (ai_memory)
                                    List Providers Tool  --> AI Agent (ai_tool)
                                    Check Availability   --> AI Agent (ai_tool)
                                    Submit Booking Tool  --> AI Agent (ai_tool)
                                    Identify Patient     --> AI Agent (ai_tool)
                                    Link Account         --> AI Agent (ai_tool)
                                    Get My Appointments  --> AI Agent (ai_tool)
```

### 4.5 n8n Credentials to create

| #   | Credential Name    | Type         | Value                                                   |
| --- | ------------------ | ------------ | ------------------------------------------------------- |
| 1   | `Telegram Bot API` | Telegram API | Token: `8861389339:AAGcubm_AJcu2QZZDP9FkQb5fW21XmBXQwI` |

---

## Phase 5: Update AI System Rules

### 5.1 Changes to `AI_SYSTEM_RULES.md`

**File:** `C:\Users\yazan\OneDrive\Desktop\n8nflow\AI_SYSTEM_RULES.md`

Update the following sections:

#### Title & Scope

```markdown
# Telegram Booking AI Agent — System Rules

You are a **Clinic Booking Assistant** for a medical clinic. Your sole purpose is to help patients book, reschedule, or inquire about available appointment slots via Telegram.
```

#### New Step 0: Patient Identification (before Greeting)

Add before Step 1:

```markdown
#### Step 0: Identify Patient

- When a new conversation starts, call the `identify_patient` tool with the user's Telegram Chat ID.
- If `linked: true`, greet the patient by name: "Hello [Name]! How can I help you today?"
- If `linked: false`, ask: "Welcome! To help you, I'll need to verify your account. What is your registered phone number?"
- When the patient provides a phone number, call `link_account` with `{ phone, telegramChatId }`.
  - If successful: "Great, you're verified! How can I help you today?"
  - If patient not found: "I couldn't find an account with that number. Please check and try again, or contact the clinic to register."
  - If already linked to another account: "This Telegram account is already linked to a different patient. Please contact the clinic."
- Once linked, proceed to Step 1.
```

#### New Tool: `get_my_appointments`

Add to Tool Usage Rules section:

```markdown
- Use `get_my_appointments` when the patient asks "What are my appointments?", "When is my next appointment?", or similar.
- Only call this tool AFTER the patient is identified (Step 0 complete).
- Present appointments in a clear format: date, time, doctor, status.
```

#### Update all "WhatsApp" references to "Telegram"

- Title: "WhatsApp" → "Telegram"
- Any mention of "WhatsApp metadata" → "Telegram metadata"
- Phone number from WhatsApp (WaId) → Phone number provided by user

### Files to modify

| #   | File                                                         | Change                                                                                                         |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 1   | `C:\Users\yazan\OneDrive\Desktop\n8nflow\AI_SYSTEM_RULES.md` | Add Step 0 (patient identification), add `get_my_appointments` tool, replace WhatsApp references with Telegram |

---

## Security & Data Leakage Prevention

| Risk                                        | Mitigation                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patient sees another patient's appointments | `GET /api/telegram/my-appointments` filters by `telegramChatId` → `patientId`. Never returns unscoped data.                                                |
| Unauthorized Telegram linking               | `POST /api/telegram/link-account` requires a valid phone that exists in the Patient table. Returns 409 if Telegram Chat ID already linked to someone else. |
| Telegram Chat ID spoofing                   | Telegram Chat IDs are assigned by Telegram and cannot be forged. The n8n Telegram Trigger node receives the authenticated `chat.id` from Telegram's API.   |
| Cross-patient data in AI context            | AI tools return only the current patient's data. The `identify_patient` endpoint returns only `patientId`, `name`, `phone` — no medical data.              |

---

## Execution Order

| #   | Step                                                                          | Depends on  |
| --- | ----------------------------------------------------------------------------- | ----------- |
| 1   | Add `TELEGRAM_BOT_TOKEN` to `.env` and `.env.example`                         | —           |
| 2   | Add `telegramChatId` field to Prisma schema                                   | —           |
| 3   | Run `npx prisma migrate dev --name add-telegram-chat-id`                      | Step 2      |
| 4   | Create `POST /api/telegram/link-account`                                      | Step 3      |
| 5   | Create `POST /api/telegram/identify`                                          | Step 3      |
| 6   | Create `GET /api/telegram/my-appointments`                                    | Step 3      |
| 7   | Run `npm run build` to verify                                                 | Steps 4-6   |
| 8   | Duplicate `WhatsApp AI Booking Agent.json` → `Telegram AI Booking Agent.json` | —           |
| 9   | Modify the duplicated workflow (nodes, connections, tools)                    | Step 8      |
| 10  | Update `AI_SYSTEM_RULES.md` for Telegram                                      | —           |
| 11  | Import `Telegram AI Booking Agent.json` into n8n UI                           | Steps 9-10  |
| 12  | Create Telegram Bot API credential in n8n                                     | —           |
| 13  | Activate the workflow and test end-to-end                                     | Steps 11-12 |

---

## Files Summary

### Files to modify (Calendar project)

| #   | File                   | Change                                |
| --- | ---------------------- | ------------------------------------- |
| 1   | `.env`                 | Add `TELEGRAM_BOT_TOKEN`              |
| 2   | `.env.example`         | Add `TELEGRAM_BOT_TOKEN` placeholder  |
| 3   | `prisma/schema.prisma` | Add `telegramChatId` to Patient model |

### Files to create (Calendar project)

| #   | File                                            | Purpose                              |
| --- | ----------------------------------------------- | ------------------------------------ |
| 4   | `src/app/api/telegram/link-account/route.ts`    | Link Telegram to patient via phone   |
| 5   | `src/app/api/telegram/identify/route.ts`        | Identify patient by Telegram Chat ID |
| 6   | `src/app/api/telegram/my-appointments/route.ts` | Get patient's appointments           |

### Files to modify (n8n folder)

| #   | File                         | Change                                                  |
| --- | ---------------------------- | ------------------------------------------------------- |
| 7   | `n8nflow/AI_SYSTEM_RULES.md` | Replace WhatsApp with Telegram, add Step 0 and new tool |

### Files to create (n8n folder)

| #   | File                                     | Purpose                        |
| --- | ---------------------------------------- | ------------------------------ |
| 8   | `n8nflow/Telegram AI Booking Agent.json` | Duplicated + modified workflow |
