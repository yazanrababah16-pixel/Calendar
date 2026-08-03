# Combined Execution Plan: Calendar Fix + n8n Cleanup

## Priority 1: Patient Calendar Access Bug — Root Cause Fix

### Root Cause (Definitive)

**The middleware in `src/proxy.ts` line 7 blocks PATIENT users from accessing `/dashboard/calendar`.**

```typescript
// src/proxy.ts:7 — CURRENT (BROKEN)
"/dashboard/calendar": ["ADMIN", "PROVIDER", "RECEPTIONIST"],  // PATIENT MISSING
```

When a PATIENT user clicks "Calendar" in the sidebar, the `hasAccess()` function matches `/dashboard/calendar` as the longest-prefix route, sees PATIENT is not in the allowed list, and redirects to `/dashboard` with no error message.

**Evidence of mismatch:**

| Layer                                                        | PATIENT Allowed?             | File                                    |
| ------------------------------------------------------------ | ---------------------------- | --------------------------------------- |
| Middleware (`src/proxy.ts:7`)                                | **NO**                       | `src/proxy.ts`                          |
| Sidebar link (`src/components/dashboard/sidebar.tsx:40`)     | YES                          | `src/components/dashboard/sidebar.tsx`  |
| Calendar page (`src/app/dashboard/calendar/page.tsx:99-137`) | YES (full support)           | `src/app/dashboard/calendar/page.tsx`   |
| Appointments API (`src/app/api/appointments/route.ts:36-45`) | YES (scoped to own data)     | `src/app/api/appointments/route.ts`     |
| Providers API (`src/app/api/providers/route.ts`)             | YES (any authenticated user) | `src/app/api/providers/route.ts`        |
| Server actions (`getCurrentPatient`, `getMyLinkedProviders`) | YES (PATIENT-only)           | `src/server/actions/patient-linking.ts` |

The sidebar shows the link, the page has full PATIENT logic, the APIs work — but the middleware blocks the route before any of that code runs.

### The Fix

**Single-line change in `src/proxy.ts`:**

```typescript
// src/proxy.ts:7 — FIXED
"/dashboard/calendar": ["ADMIN", "PROVIDER", "RECEPTIONIST", "PATIENT"],
```

### Why This Is Safe

1. **The calendar page already handles PATIENT** — lines 99-137 of `page.tsx` fetch `getCurrentPatient()`, `getMyLinkedProviders()`, and filter appointments by `patientId`. No new page logic needed.
2. **The APIs are already PATIENT-safe** — `/api/appointments` (line 36-45) scopes PATIENT queries to their own `patientId`. `/api/providers` returns all active providers to any authenticated user.
3. **Server actions are PATIENT-safe** — `getCurrentPatient()` and `getMyLinkedProviders()` are PATIENT-only actions that return the patient's own data.
4. **No data leakage** — PATIENT users see only their own appointments. They cannot see other patients' data.
5. **No role escalation** — PATIENT users cannot create, modify, or delete appointments through the calendar (those actions check roles server-side).

### Files to Modify

| #   | File             | Change                                             |
| --- | ---------------- | -------------------------------------------------- |
| 1   | `src/proxy.ts:7` | Add `"PATIENT"` to the calendar route's role array |

### Verification Steps

1. After the fix, build the project: `npm run build`
2. Log in as a PATIENT user
3. Verify sidebar shows "Calendar" link (already works)
4. Click "Calendar" — should load the calendar view, NOT redirect to `/dashboard`
5. Verify the calendar shows only the patient's own appointments
6. Verify "Book Appointment" button works for PATIENT
7. Test as ADMIN/PROVIDER/RECEPTIONIST — no regression

---

## Priority 2: n8n Workflow Cleanup & Telegram Prep

### Current Inventory (`C:\Users\yazan\OneDrive\Desktop\n8nflow`)

| #   | File                                 | Status          | Purpose                                       |
| --- | ------------------------------------ | --------------- | --------------------------------------------- |
| 1   | `AI_SYSTEM_RULES.md`                 | KEEP            | System prompt for AI booking agent            |
| 2   | `My workflow 3.json`                 | **DELETE**      | Old Google Sheets-based reminder (superseded) |
| 3   | `WhatsApp AI Booking Agent.json`     | KEEP (active)   | AI-powered booking chatbot                    |
| 4   | `WhatsApp Appointment Reminder.json` | KEEP (active)   | Appointment reminders via WhatsApp            |
| 5   | `WhatsApp Booking Agent.json`        | **DELETE**      | Rule-based agent (superseded by AI version)   |
| 6   | `WhatsApp Booking Confirmed.json`    | KEEP (active)   | Confirmation messages                         |
| 7   | `WhatsApp Booking Modified.json`     | KEEP (inactive) | Modification messages                         |
| 8   | `WhatsApp Booking Rejected.json`     | KEEP (inactive) | Rejection messages                            |

### Files to DELETE

| #   | File                          | Reason                                                                                                                                                         |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `My workflow 3.json`          | Old prototype — polls Google Sheets every 15 min. Superseded by `WhatsApp Appointment Reminder.json` which uses a webhook pattern (cleaner, more reliable).    |
| 2   | `WhatsApp Booking Agent.json` | Rule-based regex parser — superseded by `WhatsApp AI Booking Agent.json` which uses an LLM agent for natural language understanding. Both are `active: false`. |

### Files to KEEP (Active System)

| #   | File                                 | Role in System                                                         |
| --- | ------------------------------------ | ---------------------------------------------------------------------- |
| 1   | `AI_SYSTEM_RULES.md`                 | System prompt fed to the AI Agent node                                 |
| 2   | `WhatsApp AI Booking Agent.json`     | Main entry point — receives WhatsApp messages, routes through AI agent |
| 3   | `WhatsApp Appointment Reminder.json` | Sends 24-hour reminders to patients                                    |
| 4   | `WhatsApp Booking Confirmed.json`    | Sends confirmation after booking approval                              |
| 5   | `WhatsApp Booking Modified.json`     | Sends modification notifications (inactive, keep for future use)       |
| 6   | `WhatsApp Booking Rejected.json`     | Sends rejection notifications (inactive, keep for future use)          |

### Telegram Bot Prep

After cleanup, the n8n folder will be clean and ready for Telegram workflows. The existing architecture (webhook-based + AI agent) maps directly to Telegram:

- Replace WhatsApp webhook nodes with Telegram Bot API nodes
- Keep the same AI agent, tools, and system prompt (`AI_SYSTEM_RULES.md`)
- Same backend integration points (`/api/providers/active`, `/api/availability/slots`, `/api/webhooks/n8n/requests`)

---

## Execution Order

1. **Fix `src/proxy.ts`** — add PATIENT to calendar route (1 line change)
2. **Build & verify** — `npm run build` + manual testing
3. **Delete old n8n files** — remove `My workflow 3.json` and `WhatsApp Booking Agent.json`
4. **Confirm cleanup** — verify remaining files are the correct active set

---

## Alignment with Project Rules

| Rule File                                   | Relevance                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `rules/security-devsecops-ssdls-appsec.mdc` | RBAC: middleware must enforce role-based access consistently            |
| `rules/nextjs.mdc`                          | App Router middleware patterns                                          |
| `rules/clean-code.mdc`                      | Single responsibility — middleware handles access, page handles display |
| `rules/typescript.mdc`                      | Type-safe Role union used throughout                                    |

The fix aligns with all applicable rules: the middleware correctly uses the `Role` type, the `hasAccess` function uses longest-prefix matching, and the page component properly handles PATIENT data fetching with role-appropriate filters.
