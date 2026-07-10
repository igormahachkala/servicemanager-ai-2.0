/**
 * Tool Dispatcher — domain types (AI-COMPANY-111B).
 *
 * Tools (Cursor, Claude Code, Codex) are NOT digital employees.
 * MAX decides; dispatcher selects and routes to the tool adapter.
 * V1: mock dispatch only — no real Cursor API launch.
 */

import type { ToolRegistryV1ToolId } from '../toolRegistry/toolRegistry'

export const TOOL_DISPATCHER_VERSION = 'v1' as const

/** Dispatcher-level tool ids (shorter aliases for routing). */
export const TOOL_DISPATCHER_TOOL_IDS = ['cursor'] as const

export type ToolDispatcherToolId = (typeof TOOL_DISPATCHER_TOOL_IDS)[number]

/** Runtime availability of a registered tool. */
export const TOOL_STATUSES = ['available', 'busy', 'offline'] as const

export type ToolStatus = (typeof TOOL_STATUSES)[number]

export const TOOL_DISPATCHER_RESULT_STATUSES = [
  'accepted',
  'planned',
  'mock_completed',
  'rejected',
  'failed',
] as const

export type ToolDispatcherResultStatus = (typeof TOOL_DISPATCHER_RESULT_STATUSES)[number]

export type ToolDispatcherEndpointRef = {
  /** Env/config key — never a raw IP in domain code. */
  configKey: string
  baseUrl: string | null
  submitPath: string
  statusPath: string
}

/** Catalog entry: what a tool can do. Tools ≠ employees. */
export type ToolCapability = {
  toolId: ToolDispatcherToolId
  label: string
  description: string
  registryToolId: ToolRegistryV1ToolId
  /** Always false — explicit invariant for callers and UI. */
  isEmployee: false
  supportedActions: readonly string[]
  requiresOwnerApproval: boolean
  endpoint: ToolDispatcherEndpointRef
}

export type ToolDispatcherRegistryEntry = {
  capability: ToolCapability
  status: ToolStatus
  statusReason: string | null
  updatedAt: string
}

export type ToolRequestContext = {
  companyId: string | null
  workspaceId: string | null
  projectId: string | null
  runtimeRunId: string | null
  maxWorkerLoopId: string | null
  chatId: string | null
  source: 'max_chat' | 'runtime' | 'manual' | 'scheduler'
}

/** Dispatch request — MAX decides, dispatcher picks tool. */
export type ToolRequest = {
  requestId: string
  toolId: ToolDispatcherToolId
  action: string
  title: string
  instructions: string
  requestedByEmployeeId: string
  /** MAX (or delegated decider) — not the tool itself. */
  decidedByEmployeeId: string
  payload: Record<string, unknown>
  context: ToolRequestContext
  createdAt: string
}

export type ToolDispatcherLogEntry = {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export type ToolResult = {
  requestId: string
  toolId: ToolDispatcherToolId
  status: ToolDispatcherResultStatus
  ok: boolean
  deliveryMode: 'mock_v1' | 'planned_v1'
  output: Record<string, unknown> | null
  error: string | null
  cursorAutomationTaskId: string | null
  registryInvokePlanId: string | null
  finishedAt: string
  logs: ToolDispatcherLogEntry[]
}

export type DispatchToolRequestInput = {
  toolId: ToolDispatcherToolId
  action: string
  title: string
  instructions: string
  requestedByEmployeeId: string
  decidedByEmployeeId: string
  payload?: Record<string, unknown>
  context?: Partial<ToolRequestContext>
}

export type DispatchToolRequestOutcome = {
  request: ToolRequest
  result: ToolResult
}
