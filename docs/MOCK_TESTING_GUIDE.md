# Mock Testing Mode — WhatsApp Booking Workflow

## Quick Start

### 1. Enable Mock Mode

Add to your `.env`:

```
MOCK_WEBHOOK_MODE=true
```

Restart the dev server: `npm run dev`

### 2. Send a Mock Booking Request

```bash
node scripts/test-booking.js
```

Or with custom data:

```bash
node scripts/test-booking.js --phone +970599887766 --date 2026-07-28 --time 10:00 --name "Ahmad"
```

### 3. List Pending Requests

```bash
node scripts/test-booking.js --list
```

### 4. Approve a Request

```bash
node scripts/test-booking.js --approve <booking-request-id>
```

### 5. Reject a Request

```bash
node scripts/test-booking.js --reject <booking-request-id> --reason "Provider unavailable"
```

---

## API Payload Structure

### POST /api/webhooks/n8n/requests

```json
{
  "workflowType": "booking_request",
  "idempotencyKey": "mock-1721953200000-abc123",
  "patientPhone": "+970599123456",
  "patientName": "Test Patient",
  "requestedDate": "2026-07-28",
  "requestedTime": "09:00",
  "durationMinutes": 30,
  "message": "I'd like to book an appointment on Monday at 9am"
}
```

### Using cURL

```bash
curl -X POST http://localhost:3000/api/webhooks/n8n/requests \
  -H "Content-Type: application/json" \
  -d '{
    "workflowType": "booking_request",
    "idempotencyKey": "curl-test-'$(date +%s)'",
    "patientPhone": "+970599123456",
    "patientName": "cURL Test",
    "requestedDate": "2026-07-28",
    "requestedTime": "11:00",
    "durationMinutes": 30,
    "message": "Testing from cURL"
  }'
```

### Using PowerShell

```powershell
$body = @{
    workflowType = "booking_request"
    idempotencyKey = "ps-test-$(Get-Date -Format yyyyMMddHHmmss)"
    patientPhone = "+970599123456"
    patientName = "PowerShell Test"
    requestedDate = "2026-07-28"
    requestedTime = "14:00"
    durationMinutes = 30
    message = "Testing from PowerShell"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks/n8n/requests" -Method POST -Body $body -ContentType "application/json"
```

---

## HMAC Bypass Logic

The webhook route checks for `MOCK_WEBHOOK_MODE` env var:

```
MOCK_WEBHOOK_MODE=true  → HMAC check skipped (for testing)
N8N_WEBHOOK_SECRET unset → HMAC check skipped (existing behavior)
```

**No signature header is needed** when `MOCK_WEBHOOK_MODE=true`.

---

## Test API Routes (Mock Mode Only)

| Route                       | Method | Purpose                               |
| --------------------------- | ------ | ------------------------------------- |
| `/api/test/list-bookings`   | GET    | List all booking requests             |
| `/api/test/approve-booking` | POST   | Approve a request, create appointment |
| `/api/test/reject-booking`  | POST   | Reject a request with reason          |

All test routes return 403 if `MOCK_WEBHOOK_MODE !== "true"`.

---

## Full Test Flow

```bash
# 1. Start dev server
npm run dev

# 2. Send a booking request
node scripts/test-booking.js --phone +970599111222 --date 2026-07-29 --time 09:00

# 3. Check the database — request should appear as PENDING
node scripts/test-booking.js --list

# 4. Go to http://localhost:3000/dashboard/receptionist/requests
#    → See the request in the left panel
#    → Click it → See details in right panel
#    → Click Approve/Reject

# 5. Verify in database
node scripts/test-booking.js --list
```

---

## Outbound Mocking (n8n Side)

Since Meta WhatsApp API is not available, modify the n8n outbound workflows:

### Option A: Log to Console (Fastest)

Replace the "Send WhatsApp" node with a **Code node** that logs:

```javascript
console.log("WOULD SEND TO WHATSAPP:", JSON.stringify($input.first().json, null, 2));
return $input.all();
```

### Option B: Webhook.site (Free)

1. Go to https://webhook.site — get a unique URL
2. In n8n, replace "Send WhatsApp" node with an **HTTP Request** node:
   - Method: POST
   - URL: your webhook.site URL
   - Body: `={{ JSON.stringify($json) }}`
3. Check webhook.site to see the outbound payload

### Option C: Discord Webhook

1. Create a Discord channel → Integrations → Webhooks → Copy URL
2. In n8n, replace "Send WhatsApp" with HTTP Request:
   - Method: POST
   - URL: your Discord webhook URL
   - Body: `{ "content": "📱 WhatsApp would send:\n{{ $json.message }}" }`

---

## Environment Variables for Testing

```env
# .env
MOCK_WEBHOOK_MODE=true
DATABASE_URL=postgres://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

No `N8N_WEBHOOK_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, or `WHATSAPP_ACCESS_TOKEN` needed for mock testing.
