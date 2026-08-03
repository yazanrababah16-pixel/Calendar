# System Flowchart

## Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Patient["Patient"]
        TG["Telegram App"]
    end

    subgraph n8n["n8n Workflow"]
        T1["Telegram Trigger<br/><i>receives message</i>"]
        T2["Parse Telegram Message<br/><i>extract chatId, name, text</i>"]
        T3["AI Agent<br/><i>Google Gemini Flash</i>"]
        T4["Window Buffer Memory<br/><i>session key = chatId</i>"]
        T5["Send Telegram Message<br/><i>reply to user</i>"]
    end

    subgraph Gemini["Google Gemini"]
        LLM["gemini-flash-latest<br/><i>LLM inference</i>"]
    end

    subgraph Tools["AI Tools (HTTP Requests)"]
        TOOLS_identify["identify_patient<br/><i>POST /api/telegram/identify</i>"]
        TOOLS_link["link_account<br/><i>POST /api/telegram/link-account</i>"]
        TOOLS_providers["list_providers<br/><i>GET /api/providers/active</i>"]
        TOOLS_availability["check_availability<br/><i>GET /api/availability/slots</i>"]
        TOOLS_booking["submit_booking<br/><i>POST /api/webhooks/n8n/requests</i>"]
        TOOLS_appointments["get_my_appointments<br/><i>GET /api/telegram/my-appointments</i>"]
    end

    subgraph Backend["Next.js Backend API"]
        API_identify["/api/telegram/identify"]
        API_link["/api/telegram/link-account"]
        API_providers["/api/providers/active"]
        API_slots["/api/availability/slots"]
        API_requests["/api/webhooks/n8n/requests"]
        API_appointments["/api/telegram/my-appointments"]
        DB[("PostgreSQL<br/><i>Prisma ORM</i>")]
    end

    TG -->|"sends message"| T1
    T1 --> T2
    T2 -->|"telegramChatId, message"| T3
    T3 <-->|"system prompt"| LLM
    T3 <-->|"20 msg context"| T4
    T2 -.->|"conversationId key"| T4

    T3 -->|"calls tool"| TOOLS_identify
    T3 -->|"calls tool"| TOOLS_link
    T3 -->|"calls tool"| TOOLS_providers
    T3 -->|"calls tool"| TOOLS_availability
    T3 -->|"calls tool"| TOOLS_booking
    T3 -->|"calls tool"| TOOLS_appointments

    TOOLS_identify --> API_identify
    TOOLS_link --> API_link
    TOOLS_providers --> API_providers
    TOOLS_availability --> API_slots
    TOOLS_booking --> API_requests
    TOOLS_appointments --> API_appointments

    API_identify --> DB
    API_link --> DB
    API_providers --> DB
    API_slots --> DB
    API_requests --> DB
    API_appointments --> DB

    T3 -->|"response text"| T5
    T5 -->|"sends reply"| TG

    style Patient fill:#e3f2fd,stroke:#1565c0
    style n8n fill:#fff3e0,stroke:#ef6c00
    style Gemini fill:#fce4ec,stroke:#c62828
    style Tools fill:#e8f5e9,stroke:#2e7d32
    style Backend fill:#f3e5f5,stroke:#6a1b9a
```

---

## How the Flow Works

### 1. Message Reception

The patient sends a message via Telegram. The **Telegram Trigger** node in n8n receives the update and passes it to the **Parse Telegram Message** node, which extracts three fields: `telegramChatId` (unique chat identifier), `patientName` (user's display name), and `message` (the text content).

### 2. AI Processing

The parsed message enters the **AI Agent** node, which communicates with **Google Gemini** (`gemini-flash-latest`) for inference. The AI Agent maintains conversation context through the **Window Buffer Memory** node, which stores the last 20 messages per conversation. The session is keyed by `conversationId` (the Telegram Chat ID), ensuring each user has independent memory.

### 3. Tool Execution

Based on the patient's request, the AI Agent calls one or more of the **6 available tools**. Each tool is an HTTP Request node that calls a specific Next.js API endpoint:

| Tool                  | Endpoint                            | Purpose                                       |
| --------------------- | ----------------------------------- | --------------------------------------------- |
| `identify_patient`    | `POST /api/telegram/identify`       | Check if Telegram user is linked to a patient |
| `link_account`        | `POST /api/telegram/link-account`   | Link Telegram Chat ID to patient via phone    |
| `list_providers`      | `GET /api/providers/active`         | Fetch active doctors                          |
| `check_availability`  | `GET /api/availability/slots`       | Fetch open appointment slots                  |
| `submit_booking`      | `POST /api/webhooks/n8n/requests`   | Submit a booking request                      |
| `get_my_appointments` | `GET /api/telegram/my-appointments` | Get patient's upcoming appointments           |

### 4. Backend Processing

Each API endpoint queries the **PostgreSQL database** via Prisma ORM. The Telegram-specific endpoints (`identify`, `link-account`, `my-appointments`) are public (no auth required) because they are called by the n8n agent, not by user sessions. Data fetching is strictly scoped by `telegramChatId` to prevent cross-patient data leakage.

### 5. Response Delivery

The AI Agent generates a response text, which is passed to the **Send Telegram Message** node. This node sends the reply back to the patient via the Telegram Bot API, completing the conversation loop.

---

## Conversation Flow (AI Decision Tree)

```mermaid
flowchart TD
    START["New Message"] --> ID{"Step 0:<br/>Identify Patient"}
    ID -->|"linked: true"| GREET["Step 1: Greeting<br/>(by name)"]
    ID -->|"linked: false"| ASK_PHONE["Ask for phone number"]
    ASK_PHONE --> LINK{"Call link_account"}
    LINK -->|"success"| GREET
    LINK -->|"patient not found"| RETRY["Ask to retry or<br/>contact clinic"]
    LINK -->|"409 conflict"| BLOCK["Already linked.<br/>Contact clinic."]

    GREET --> DOC["Step 2: Doctor Selection"]
    DOC -->|"list_providers"| PROVIDERS["Show available doctors"]
    PROVIDERS --> CONTACT["Step 3: Contact Info<br/>(phone, email)"]
    DOC -->|"specific doctor noted"| CONTACT

    CONTACT --> DATE["Step 4: Preferred<br/>Date & Time"]
    DATE --> AVAIL["Step 5: Check Availability<br/>(check_availability)"]
    AVAIL -->|"slots found"| PICK["Present top 3 options"]
    AVAIL -->|"no slots"| NEXT["Suggest next 7 days"]
    NEXT --> PICK

    PICK --> CONFIRM["Step 6: Confirm & Submit<br/>(submit_booking)"]
    CONFIRM -->|"confirmed"| DONE["Step 7: Post-Booking<br/>Two-way confirmation"]
    CONFIRM -->|"denied"| DATE

    DONE --> RESPOND{"Step 8: Handle Response"}
    RESPOND -->|"yes/perfect"| CLOSE["Wonderful! See you."]
    RESPOND -->|"modify/reschedule"| DATE
    RESPOND -->|"cancel"| CANCEL["Noted. Contact clinic<br/>to confirm."]

    style START fill:#e3f2fd,stroke:#1565c0
    style DONE fill:#e8f5e9,stroke:#2e7d32
    style CLOSE fill:#e8f5e9,stroke:#2e7d32
    style BLOCK fill:#fce4ec,stroke:#c62828
    style CANCEL fill:#fff3e0,stroke:#ef6c00
```
