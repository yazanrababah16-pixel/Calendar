# Clinic AI Booking System — Documentation Hub

## System Architecture

```
Telegram User
    |
    v
[Telegram Trigger]  ──n8n──>  [Parse Message]
                                    |
                                    v
                              [AI Agent]  <──  Google Gemini (gemini-flash-latest)
                             /    |    \
                            v     v     v
                    [Tools]  [Memory]  [Tools]
                    - identify_patient    - Window Buffer Memory (chat ID keyed)
                    - link_account
                    - list_providers
                    - check_availability
                    - submit_booking
                    - get_my_appointments
                            |
                            v
                    [Send Telegram Message]
                            |
                            v
                    Telegram User
```

### How It Works

1. **Telegram Trigger** receives incoming messages from users chatting with the bot.
2. **Parse Message** extracts `telegramChatId`, `patientName`, and `message` text from the Telegram update.
3. **AI Agent** (powered by Google Gemini `gemini-flash-latest`) processes the message using the system prompt and available tools.
4. **Tools** are HTTP-request-based functions that call the Next.js backend:
   - `identify_patient` — checks if the Telegram user is linked to a patient record
   - `link_account` — links a Telegram Chat ID to a patient via phone verification
   - `list_providers` — fetches active doctors from the clinic
   - `check_availability` — fetches open appointment slots for a given date/provider
   - `submit_booking` — submits a booking request to the clinic
   - `get_my_appointments` — returns the linked patient's upcoming appointments
5. **Window Buffer Memory** maintains 20-message conversation context per Telegram Chat ID.
6. **Send Telegram Message** delivers the AI's response back to the user.

### Backend API Endpoints (Next.js)

| Endpoint                        | Method | Auth | Purpose                                    |
| ------------------------------- | ------ | ---- | ------------------------------------------ |
| `/api/telegram/identify`        | POST   | None | Identify patient by Telegram Chat ID       |
| `/api/telegram/link-account`    | POST   | None | Link Telegram Chat ID to patient via phone |
| `/api/telegram/my-appointments` | GET    | None | Get linked patient's upcoming appointments |
| `/api/providers/active`         | GET    | None | List active doctors                        |
| `/api/availability/slots`       | GET    | None | Check available appointment slots          |
| `/api/webhooks/n8n/requests`    | POST   | HMAC | Submit booking request from n8n            |

---

## Table of Contents

| Document                                      | Description                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [AI System Rules](ai_system_rules.md)         | Complete system prompt for the Telegram AI Agent — conversation flow, tool usage rules, privacy compliance, and response examples |
| [n8n Configuration](n8n_configuration.md)     | Critical n8n setup notes — model selection, dummy tool parameters, workflow activation, and session memory mapping                |
| [Troubleshooting Log](troubleshooting_log.md) | Errors encountered during development and their solutions — 404 model not found, dummy parameter crashes, Minimax balance issues  |

---

## Project Structure

```
Calendar/                          # Next.js backend
  src/app/api/telegram/            # Telegram-specific API routes
    link-account/route.ts          # Link Telegram Chat ID to patient
    identify/route.ts              # Identify patient by Telegram Chat ID
    my-appointments/route.ts       # Get patient's appointments
  src/app/api/providers/active/    # Public provider listing (used by n8n)
  src/app/api/availability/slots/  # Public slot availability (used by n8n)
  src/app/api/webhooks/n8n/        # n8n webhook endpoints (HMAC-signed)
  prisma/schema.prisma             # Database schema (Patient.telegramChatId)

n8nflow/                           # n8n workflow files (external folder)
  Telegram AI Booking Agent.json   # Main n8n workflow (importable)
  AI_SYSTEM_RULES.md               # System prompt source of truth
  WhatsApp AI Booking Agent.json   # Legacy WhatsApp workflow (archived)
  WhatsApp Appointment Reminder.json
  WhatsApp Booking Confirmed.json
  WhatsApp Booking Modified.json
  WhatsApp Booking Rejected.json
```

---

## Environment Variables

```bash
# Required for Telegram bot
TELEGRAM_BOT_TOKEN=your_token_from_botfather

# Backend URL (used by n8n to call Next.js API)
NEXTJS_URL=http://localhost:3000

# AI system prompt (paste full content of AI_SYSTEM_RULES.md into n8n)
AI_SYSTEM_PROMPT=your_system_prompt_here
```
