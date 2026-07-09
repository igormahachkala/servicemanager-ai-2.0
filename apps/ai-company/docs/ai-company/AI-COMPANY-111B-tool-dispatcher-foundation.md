# AI-COMPANY-111B — Tool Dispatcher Foundation

## Goal

Фундамент для подключения **Cursor**, Claude Code, Codex и других внешних инструментов.

**Инварианты:**

- Инструменты **не** являются сотрудниками (`ToolCapability.isEmployee === false`)
- **MAX** принимает решение (`decidedByEmployeeId`)
- **Dispatcher** выбирает и маршрутизирует инструмент
- **V1 без запуска Cursor** — mock `ToolResult` через существующий Cursor Automation / Tool Registry domain
- **No IP** — endpoint только через env/config

## Domain

`apps/ai-company/src/domain/toolDispatcher/`

| File | Role |
|------|------|
| `toolDispatcherTypes.ts` | `ToolCapability`, `ToolRequest`, `ToolResult`, `ToolStatus` |
| `toolDispatcherConfig.ts` | Env-based endpoints (`VITE_TOOL_DISPATCHER_*`) |
| `toolDispatcherRegistry.ts` | Registered tools catalog (V1: Cursor) |
| `toolDispatcherDispatch.ts` | `dispatchToolRequest()` |
| `toolDispatcherStorage.ts` | localStorage requests/results |
| `index.ts` | Public exports |

## Models

### ToolStatus (availability)

`available` | `busy` | `offline`

### ToolCapability

Catalog metadata: label, registry link (`cursor-automation`), supported actions, endpoint ref, `isEmployee: false`.

### ToolRequest

Dispatch input persisted per call:

- `requestId`, `toolId`, `action`, `title`, `instructions`
- `requestedByEmployeeId`, `decidedByEmployeeId` (MAX)
- `payload`, `context` (runtimeRunId, workspaceId, …)

### ToolResult

Mock outcome (V1):

- `status`: `mock_completed` | `failed` | …
- `deliveryMode`: `mock_v1`
- Links: `cursorAutomationTaskId`, `registryInvokePlanId`
- `output.plannedOnly: true` — no adapter submit

## API

```typescript
import { dispatchToolRequest } from '../domain/toolDispatcher'

const { request, result } = dispatchToolRequest({
  toolId: 'cursor',
  action: 'handoff',
  title: 'Fix login redirect',
  instructions: '…',
  requestedByEmployeeId: 'ag-max',
  decidedByEmployeeId: 'ag-max',
  context: { source: 'max_chat', chatId: 'conv:ag-max' },
})
```

Flow:

1. Validate tool registered + `available`
2. Persist `ToolRequest`
3. For `cursor`: `planCursorAutomationHandoff()` (existing bridge)
4. Return mock `ToolResult` — **no** `submitAutomationTask`
5. Persist result

## Env / config

| Variable | Default |
|----------|---------|
| `VITE_TOOL_DISPATCHER_CURSOR_BASE_URL` | same-origin (`window.location.origin`) |
| `VITE_TOOL_DISPATCHER_CURSOR_SUBMIT_PATH` | `/api/v1/cursor-automation/submit` |
| `VITE_TOOL_DISPATCHER_CURSOR_STATUS_PATH` | `/api/v1/cursor-automation/status` |

Fallback: `VITE_CURSOR_AUTOMATION_BASE_URL`.

Raw IP in URLs is rejected by `assertToolEndpointHasNoRawIp()`.

## How to add the next tool

1. Add id to `TOOL_DISPATCHER_TOOL_IDS` in `toolDispatcherTypes.ts`
2. Extend `getToolDispatcherEndpointConfig()` with env keys
3. Create capability factory + default entry in `toolDispatcherRegistry.ts`
4. Add `case` in `dispatchToolRequest()` switch with tool-specific mock/adapter
5. Link to Tool Registry id (`claude-code-cli`, `codex-cli`, …)
6. Document env vars; never hardcode IP

Example skeleton:

```typescript
registerToolDispatcherEntry({
  capability: {
    toolId: 'claude-code',
    label: 'Claude Code',
    registryToolId: 'claude-code-cli',
    isEmployee: false,
    supportedActions: ['run'],
    requiresOwnerApproval: true,
    endpoint: getToolDispatcherEndpointConfig('claude-code'),
    description: '…',
  },
  status: 'available',
  statusReason: null,
  updatedAt: new Date().toISOString(),
})
```

## V2 backlog

- UI: Tool Dispatcher panel in MAX / Ops
- Real adapter submit after Owner approval
- Wire `busy`/`offline` from health checks
- Server-side persistence + multi-tenant `companyId` enforcement
- Unified history with `toolExecution` / `toolRegistryInvoke`
