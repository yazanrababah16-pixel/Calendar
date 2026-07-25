# Changelog — July 26, 2026

## Summary

Major session focused on the WhatsApp Booking Request system: completing the two-panel Receptionist UI, building a mock testing environment, fixing critical bugs (overlap detection, datetime validation, cache invalidation), and generating the n8n AI Agent workflow for conversational WhatsApp booking.

---

## New Features

### WhatsApp Booking Request Model & Receptionist UI
- **`BookingRequest` model** added to Prisma schema with `BookingRequestStatus` enum (PENDING, APPROVED, REJECTED, CANCELLED, AWAITING_PATIENT_REPLY)
- **Two-panel Receptionist UI** at `/dashboard/receptionist/requests`:
  - Left panel: clickable queue of PENDING requests with phone, date/time, provider, "Modified" badge
  - Right panel: request details + Approve/Reject/Modify action buttons
  - Modify flow shows smart slot suggestions (reuses `getSuggestedSlots`)
- **Inbound webhook** at `/api/webhooks/n8n/requests` — receives parsed WhatsApp messages from n8n, creates BookingRequest, looks up patient by phone, creates Notification
- **Server actions**: `getBookingRequests`, `approveBookingRequest`, `rejectBookingRequest`, `modifyBookingRequest`
- **Notification deep-linking**: `booking_request` notifications route to `/dashboard/receptionist/requests`
- **Sidebar navigation**: "Requests" nav item for RECEPTIONIST + ADMIN with `MessageSquare` icon
- **n8n workflows**: Updated inbound `WhatsApp Booking Agent.json`, created 3 outbound workflows (Confirmed, Rejected, Modified)

### Mock Testing Environment
- **`MOCK_WEBHOOK_MODE=true`** env var — bypasses HMAC verification on inbound webhook, enables test API routes
- **CLI test tool** (`scripts/test-booking.js`) — supports `--phone`, `--date`, `--time`, `--approve`, `--reject`, `--modify`, `--list`
- **Test API routes** at `/api/test/approve-booking`, `/api/test/reject-booking`, `/api/test/list-bookings` — no auth required
- **Documentation**: `docs/MOCK_TESTING_GUIDE.md`

### n8n AI Agent Workflow
- **AI System Rules** (`C:\Users\yazan\OneDrive\Desktop\n8nflow\AI_SYSTEM_RULES.md`) — System prompt for AI Agent: no medical advice, strict tone, conversation flow rules, tool usage rules, privacy compliance
- **AI Workflow JSON** (`C:\Users\yazan\OneDrive\Desktop\n8nflow\WhatsApp AI Booking Agent.json`) — Full n8n workflow with Webhook Trigger, Parse Message, AI Agent (Conversational Agent), Window Buffer Memory, Check Availability Tool, Submit Booking Tool
- **Availability API** at `/api/availability/slots` — Public endpoint for n8n AI Agent to query available appointment slots (no auth required)

---

## Bug Fixes

### Double Booking Prevention (Overlap Check)
- `approveBookingRequest` now queries existing non-cancelled appointments for the same provider+time window before creating. Returns 409 error if overlap found.
- `modifyBookingRequest` applies the same overlap check to the suggested new time.
- Test route `/api/test/approve-booking` also includes overlap check.

### Zod Datetime Validation
- Changed `z.string().datetime()` to `z.coerce.date()` in `modifySchema` for graceful parsing of ISO strings without timezone offset.

### Suggested Slots ISO Fix
- `getSuggestedSlots` now returns `slotStartDT.toISOString()` / `slotEndDT.toISOString()` (proper ISO 8601 with timezone `Z`) instead of bare `YYYY-MM-DDTHH:MM:SS` strings.

### Cache Invalidation
- Added `revalidatePath("/dashboard/receptionist/requests")` to `approveBookingRequest`, `rejectBookingRequest`, and `modifyBookingRequest`.

### Client Error Handling
- Added `catch` blocks to all three action handlers (approve/reject/modify) in `requests/page.tsx` for proper toast error display on network errors or exceptions.

### Patient Auto-Creation
- `approveBookingRequest` auto-creates Patient+User records by phone number when no linked patient exists, preventing foreign key constraint errors.

### AWAITING_PATIENT_REPLY Status
- `modifyBookingRequest` now sets status to `AWAITING_PATIENT_REPLY` instead of leaving as PENDING. This removes modified requests from the Pending queue, keeping the receptionist's inbox clean.

---

## Files Changed

### Modified
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added `AWAITING_PATIENT_REPLY` to `BookingRequestStatus` enum |
| `src/server/actions/booking-requests.ts` | Overlap checks, `z.coerce.date()`, `AWAITING_PATIENT_REPLY` status, `revalidatePath`, patient auto-creation |
| `src/server/actions/appointments.ts` | `getSuggestedSlots` returns proper ISO strings |
| `src/app/api/test/approve-booking/route.ts` | Overlap check, patient auto-creation |
| `src/app/dashboard/receptionist/requests/page.tsx` | Error toasts, "Modified" badge, suggested new time display |
| `docs/WHATSAPP_BOOKING_PLAN.md` | Marked all phases complete, added Phase 10-12, state machine diagram |
| `docs/ARCHITECTURE.md` | Added WhatsApp AI Agent flow, booking state machine, overlap check diagram, updated ERD |
| `docs/PROJECT_HANDOVER.md` | Added Phase 8-10, updated key files, git history |

### Created
| File | Purpose |
|------|---------|
| `src/app/api/availability/slots/route.ts` | Public availability slots API for n8n AI Agent |
| `scripts/test-booking.js` | CLI test tool for WhatsApp booking flow |
| `docs/MOCK_TESTING_GUIDE.md` | Mock testing workflow documentation |
| `docs/CHANGELOG_JULY_26_2026.md` | This file |
| `C:\...\n8nflow\AI_SYSTEM_RULES.md` | AI Agent system prompt |
| `C:\...\n8nflow\WhatsApp AI Booking Agent.json` | n8n AI Agent workflow JSON |

---

## Git Commits

```
d074475 feat: public availability slots API endpoint for n8n AI agent
520e4d8 fix: AWAITING_PATIENT_REPLY status, error toasts, queue cleanup for booking requests
a505604 fix: overlap checks, datetime validation, revalidatePath, UI polish for booking requests
```

---

## Testing

### Backend (CLI)
```bash
node scripts/test-booking.js --phone +962790000000 --date 2026-07-28 --time 10:00   # Create
node scripts/test-booking.js --list                                                   # List pending
node scripts/test-booking.js --approve <id>                                            # Approve
node scripts/test-booking.js --reject <id> --reason "Fully booked"                    # Reject
```

### Overlap Detection Verified
- First approve of same provider+time → 200 OK (appointment created)
- Second approve of same provider+time → 409 Conflict ("This time slot is already booked")

### UI Testing
- Navigate to `/dashboard/receptionist/requests` (login as RECEPTIONIST or ADMIN)
- Approve/Reject actions show toast and remove item from queue
- Modify flow shows slot suggestions, sets AWAITING_PATIENT_REPLY, removes from queue

---

## Next Steps

1. Update Vercel environment variables (DATABASE_URL, DIRECT_DATABASE_URL)
2. Import `WhatsApp AI Booking Agent.json` into n8n
3. Set `NEXTJS_URL` and `AI_SYSTEM_PROMPT` env vars in n8n
4. End-to-end test: WhatsApp message → AI conversation → booking confirmation
5. Wire appointment creation/reminder events to n8n webhook for automated notifications
