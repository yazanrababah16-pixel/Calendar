# n8n Configuration Guide

Critical configuration notes for the Telegram AI Booking Agent workflow in n8n.

---

## 1. Model Selection — Use Expression for Stability

**Problem:** Manually selecting a model in the AI Agent node can cause "404 Model Not Found" errors when n8n updates or the model ID changes.

**Solution:** Use an **Expression** to set the model dynamically.

In the AI Agent node:

1. Click the **Model** field
2. Switch to **Expression** mode (click the `=` button)
3. Enter: `models/gemini-flash-latest`

This ensures n8n always resolves to the latest stable Gemini Flash model without hardcoding a version number.

---

## 2. Tools with Zero Input — The Dummy Parameter Trick

**Problem:** Google Gemini (and some other LLMs) crash with a `key cannot be empty` error when the AI tries to call a tool that requires no input parameters (e.g., `list_providers` or `identify_patient` with only a chat ID passed via context).

**Root Cause:** The LLM generates an empty `parameters: {}` object. Gemini's API rejects requests where a tool's parameter schema expects fields but receives none.

**Solution:** Add a **dummy query parameter** to every tool that technically requires no user-provided input.

### How to configure:

For tools like `list_providers`, `identify_patient`, or `get_my_appointments`:

1. Open the **HTTP Request Tool** node
2. Scroll to **Query Parameters**
3. Select **Using Field Below** (NOT "Using JSON")
4. Add a parameter:
   - **Name:** `dummy`
   - **Value:** `1`
5. This sends `?dummy=1` in the URL, which the backend ignores, but it satisfies Gemini's requirement that tools have at least one parameter

### Example tool configuration:

```
Tool name: list_providers
Method: GET
URL: http://localhost:3000/api/providers/active
Query Parameters (Using Field Below):
  - Name: dummy | Value: 1
```

The backend route ignores unknown query params, so `dummy=1` is harmless.

---

## 3. Workflow Activation — Must Be "Active" for Continuous Operation

**Problem:** The workflow only runs when manually triggered via the "Test Workflow" button. It does not respond to live Telegram messages.

**Solution:** The workflow must be set to **Active** via the Publish menu.

### Steps:

1. Open the workflow in n8n
2. Click **Publish** (top-right corner)
3. Toggle **Active** to ON
4. The workflow now runs continuously in the background
5. Every incoming Telegram message triggers the workflow automatically

### Important notes:

- An **inactive** workflow only processes messages when you manually click "Test Workflow"
- An **active** workflow processes ALL incoming messages in real-time
- You can have multiple active workflows simultaneously
- To stop processing, toggle Active to OFF or delete the workflow

---

## 4. Window Buffer Memory — Session ID Mapping

**Problem:** The AI loses conversation context between messages because sessions are not properly linked.

**Solution:** The Window Buffer Memory node's **Session ID** must be mapped to the Telegram Chat ID.

### Configuration:

In the **Window Buffer Memory** node:

1. Set **Session ID Type** to `Custom Key`
2. Set **Session Key** to an expression:
   ```
   ={{ $('Parse Telegram Message').item.json.conversationId }}
   ```
3. Set **Context Window Length** to `20` (keeps last 20 messages per conversation)

### Why this works:

- Each Telegram user has a unique `chat.id`
- The **Parse Telegram Message** node extracts this as `conversationId`
- The memory node uses this as the session key
- Result: each user gets their own independent conversation history
- The AI remembers what was discussed earlier in the same chat

### Without this mapping:

- All users share one conversation context (chaos)
- Or each message is treated as a new conversation (no memory)

---

## 5. Telegram Credential Setup

### Creating the credential:

1. In n8n, go to **Credentials** → **Add Credential**
2. Search for **Telegram API**
3. Name it `Telegram Bot API`
4. Paste your bot token (from @BotFather)
5. Save

### Assigning to nodes:

In both the **Telegram Trigger** and **Send Telegram Message** nodes:

1. Click the **Credential** dropdown
2. Select `Telegram Bot API`
3. The node will now use your bot token for all API calls

---

## 6. Environment Variables in n8n

Set these in n8n's environment (Settings → Environment Variables):

| Variable           | Value                                          | Used By                        |
| ------------------ | ---------------------------------------------- | ------------------------------ |
| `NEXTJS_URL`       | `http://localhost:3000` (or your deployed URL) | All HTTP Request Tool nodes    |
| `AI_SYSTEM_PROMPT` | Full content of `AI_SYSTEM_RULES.md`           | AI Agent node (system message) |

---

## Quick Reference — Node Settings

| Node                  | Key Setting        | Value                                                         |
| --------------------- | ------------------ | ------------------------------------------------------------- |
| Telegram Trigger      | Updates            | `["message"]`                                                 |
| AI Agent              | Model (Expression) | `models/gemini-flash-latest`                                  |
| AI Agent              | System Message     | `={{ $env.AI_SYSTEM_PROMPT }}`                                |
| Window Buffer Memory  | Session ID Type    | Custom Key                                                    |
| Window Buffer Memory  | Session Key        | `={{ $('Parse Telegram Message').item.json.conversationId }}` |
| Window Buffer Memory  | Context Window     | 20                                                            |
| All HTTP Tools        | Query Params       | Add `dummy=1` via "Using Field Below"                         |
| Send Telegram Message | Chat ID            | `={{ $('Parse Telegram Message').item.json.telegramChatId }}` |
| Send Telegram Message | Parse Mode         | Markdown                                                      |
