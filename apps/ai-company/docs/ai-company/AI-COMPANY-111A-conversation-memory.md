# AI-COMPANY-111A — Conversation Memory V1

## Goal

MAX помнит переписку с Owner и использует контекст в каждом ответе Ollama.

**Constraints:** localStorage + domain snapshots only; Runtime / Worker Loop не менялись.

## Storage

### Chat history (per employee)

**Key:** `ai-company-mobile-employee-chat` (110A)

```json
{
  "version": "v1",
  "sessions": {
    "ag-max": { "employeeId": "ag-max", "messages": [...], "updatedAt": "..." }
  }
}
```

### Working memory (per employee)

**Key:** `ai-company-employee-conversation-memory`

```json
{
  "version": "v1",
  "employees": {
    "ag-max": {
      "employeeId": "ag-max",
      "workingMemory": {
        "currentlyDoing": ["In progress: …", "Worker loop: …"],
        "promisedToDo": ["Task proposal: …"],
        "awaitingConfirmation": ["Confirm task: …", "Cursor handoff: …"],
        "conversationSummary": "Earlier (12 msgs): Owner: …; MAX proposed task …",
        "updatedAt": "ISO8601"
      }
    }
  }
}
```

**Sync event:** `ai-company-employee-conversation-memory-sync`

## Context window

| Limit | Value |
|-------|-------|
| Live messages in prompt | last **50** (non-pending) |
| Older messages | heuristic **summary** (max 600 chars) |

## Context sources (before each Ollama reply)

| Section | Source |
|---------|--------|
| Conversation summary | older messages + previous summary |
| Working memory | sync from chat + domain |
| Active tasks | `loadEmployeeWorkItems()` — pending/in_progress/blocked |
| Recent reports | `buildMobileReportsSnapshot()` |
| Open Cursor handoffs | `loadCursorHandoffFromChatProposals()` — proposal/copied/sent/result_pending |
| Recent Owner decisions | `buildMobileOwnerDecisionsSnapshot()` |
| Recent messages | last 50 from chat session |

## Files

| File | Role |
|------|------|
| `domain/conversationMemory/conversationMemoryTypes.ts` | types + constants |
| `domain/conversationMemory/conversationMemoryStorage.ts` | working memory localStorage |
| `domain/conversationMemory/conversationMemorySummary.ts` | 50-msg window + heuristic summary |
| `domain/conversationMemory/conversationMemoryWorkingMemory.ts` | sync working memory from domain |
| `domain/conversationMemory/conversationMemoryContext.ts` | build + format prompt context |
| `mobile/chat/mobileMaxChatResponder.ts` | inject context into Ollama prompt |
| `mobile/hooks/useMobileMaxChat.ts` | record exchange + status hint |

## UI

Status bar when ready: «Помнит N сообщений · контекст W» (`t.mobile.maxChat.status.memoryHint`).

## Out of scope (V2+)

- LLM-generated conversation summary (extra Ollama call)
- Semantic memory / embeddings
- Backend sync
- Intent classification with full context (111A = Ollama reply path only)
