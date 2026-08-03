# Troubleshooting Log

Errors encountered during development and their solutions.

---

## 1. `key cannot be empty` — Gemini Tool Parameter Crash

**Error:**

```
key cannot be empty
```

or

```
Request failed: tools[0].function.parameters.properties: must have at least one property
```

**When it happens:** The AI Agent tries to call a tool (e.g., `list_providers`) that has no required parameters. Gemini's API rejects the empty parameters object.

**Solution:** Add a `dummy=1` query parameter to every tool via the "Using Field Below" option in the HTTP Request Tool node. See [n8n Configuration — Dummy Parameter Trick](n8n_configuration.md#2-tools-with-zero-input--the-dummy-parameter-trick).

**Status:** Resolved

---

## 2. `404 Model Not Found` — Gemini Model ID Mismatch

**Error:**

```
404 Not Found: The model 'gemini-1.5-flash' does not exist
```

or

```
404 Model Not Found
```

**When it happens:** The AI Agent node has a hardcoded model ID that no longer exists or has been deprecated by Google.

**Solution:** Switch the Model field to **Expression** mode and use `models/gemini-flash-latest`. This always resolves to the latest stable version. See [n8n Configuration — Model Selection](n8n_configuration.md#1-model-selection--use-expression-for-stability).

**Status:** Resolved

---

## 3. Minimax `insufficient balance` Error

**Error:**

```
insufficient balance
```

or

```
Minimax API error: billing quota exceeded
```

**When it happens:** The AI Agent was configured to use a Minimax model instead of Gemini. Minimax requires a paid account with sufficient balance.

**Solution:** Switch back to Google Gemini (`models/gemini-flash-latest`). Gemini Flash has a generous free tier that covers development and moderate production use.

**Alternative:** If you need Minimax for production, ensure your Minimax account has sufficient balance before switching.

**Status:** Resolved (switched to Gemini)

---

## 4. Workflow Not Responding to Live Messages

**Error:** The workflow only runs when manually clicking "Test Workflow". Live Telegram messages are ignored.

**When it happens:** The workflow is in **Inactive** mode (default after import).

**Solution:** Click **Publish** → toggle **Active** to ON. See [n8n Configuration — Workflow Activation](n8n_configuration.md#3-workflow-activation--must-be-active-for-continuous-operation).

**Status:** Resolved

---

## 5. AI Loses Conversation Context Between Messages

**Error:** The AI responds to each message as if it's a new conversation. It doesn't remember what was discussed earlier.

**When it happens:** The Window Buffer Memory node's Session ID is not mapped to the Telegram Chat ID, or is mapped incorrectly.

**Solution:** Set the Window Buffer Memory node's Session Key to:

```
={{ $('Parse Telegram Message').item.json.conversationId }}
```

where `conversationId` is the extracted `chat.id` from the Parse Telegram Message node. See [n8n Configuration — Session ID Mapping](n8n_configuration.md#4-window-buffer-memory--session-id-mapping).

**Status:** Resolved

---

## 6. `Misconfigured placeholder dummy` — Wrong Parameter Configuration

**Error:**

```
Misconfigured placeholder dummy
```

or the dummy parameter is not being sent correctly.

**When it happens:** The dummy query parameter was added using "Using JSON" mode instead of "Using Field Below", causing a malformed query string.

**Solution:** In the HTTP Request Tool node:

1. Go to **Query Parameters**
2. Select **Using Field Below** (NOT "Using JSON")
3. Add: Name = `dummy`, Value = `1`

**Status:** Resolved

---

## 7. Telegram Bot Not Receiving Messages

**Error:** Messages sent to the bot on Telegram are not triggering the workflow.

**Possible causes and solutions:**

| Cause                               | Solution                                                 |
| ----------------------------------- | -------------------------------------------------------- |
| Bot token is wrong                  | Verify in @BotFather, regenerate if needed               |
| Workflow is inactive                | Toggle Active ON in Publish menu                         |
| Telegram Trigger node misconfigured | Ensure Updates = `["message"]`                           |
| n8n cannot reach Telegram API       | Check network/firewall settings                          |
| Credential not assigned             | Select `Telegram Bot API` credential on the trigger node |

**Status:** Resolved

---

## 8. `patient not found` During Account Linking

**Error:**

```
I couldn't find an account with that number.
```

**When it happens:** The phone number provided by the user doesn't match any record in the `patients` table.

**Possible causes:**

- User is not registered in the clinic system yet
- Phone number format mismatch (e.g., `+962791234567` vs `0791234567`)
- Extra spaces or dashes in the phone number

**Solution:** The backend normalizes phone numbers by stripping spaces, dashes, and parentheses. Ask the user to provide their number with country code (e.g., `+962791234567`).

**Status:** By design — user must be registered first

---

## 9. `link_account` Returns 409 Conflict

**Error:**

```
This Telegram account is already linked to a different patient.
```

**When it happens:** The Telegram Chat ID is already associated with a different patient record.

**Solution:** This is a security feature. Each Telegram account can only be linked to one patient. If the user needs to change the link, an admin must manually clear the `telegramChatId` field in the database.

**Status:** By design

---

## Quick Reference — Error to Solution Map

| Error                             | Solution Doc                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `key cannot be empty`             | [Dummy Parameter Trick](n8n_configuration.md#2-tools-with-zero-input--the-dummy-parameter-trick)           |
| `404 Model Not Found`             | [Model Selection](n8n_configuration.md#1-model-selection--use-expression-for-stability)                    |
| `insufficient balance` (Minimax)  | Switch to Gemini (`models/gemini-flash-latest`)                                                            |
| Workflow not responding           | [Workflow Activation](n8n_configuration.md#3-workflow-activation--must-be-active-for-continuous-operation) |
| AI loses context                  | [Session ID Mapping](n8n_configuration.md#4-window-buffer-memory--session-id-mapping)                      |
| `Misconfigured placeholder dummy` | Use "Using Field Below", not "Using JSON"                                                                  |
| Bot not receiving messages        | Check token, workflow active status, credential, trigger config                                            |
| `patient not found`               | User must be registered; use country code format                                                           |
| `409 link conflict`               | Admin must clear old `telegramChatId` in DB                                                                |
