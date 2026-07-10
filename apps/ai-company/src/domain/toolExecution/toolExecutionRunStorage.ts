/**
 * Tool Execution Run — localStorage persistence (AI-COMPANY-113A).
 */

import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  TOOL_EXECUTION_RUN_STORAGE_KEY,
  TOOL_EXECUTION_RUN_SYNC_EVENT,
  TOOL_EXECUTION_RUN_VERSION,
  type CreateToolExecutionRunInput,
  type ListToolExecutionRunsFilter,
  type RecordToolExecutionResultInput,
  type ToolExecutionRun,
  type ToolExecutionRunHistoryEntry,
  type ToolExecutionRunResult,
  type ToolExecutionRunStatus,
} from './toolExecutionRunTypes'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(TOOL_EXECUTION_RUN_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const TERMINAL_STATUSES = new Set<ToolExecutionRunStatus>([
  'accepted',
  'rejected',
  'failed',
  'cancelled',
])

type StoreSnapshot = {
  version: typeof TOOL_EXECUTION_RUN_VERSION
  runs: ToolExecutionRun[]
  updatedAt: string
}

function emptySnapshot(): StoreSnapshot {
  return { version: TOOL_EXECUTION_RUN_VERSION, runs: [], updatedAt: nowIso() }
}

function readSnapshot(): StoreSnapshot {
  if (typeof window === 'undefined') return emptySnapshot()
  try {
    const raw = window.localStorage.getItem(TOOL_EXECUTION_RUN_STORAGE_KEY)
    if (!raw) return emptySnapshot()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== TOOL_EXECUTION_RUN_VERSION) return emptySnapshot()
    return {
      version: TOOL_EXECUTION_RUN_VERSION,
      runs: Array.isArray(parsed.runs) ? (parsed.runs as ToolExecutionRun[]) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
    }
  } catch {
    return emptySnapshot()
  }
}

function writeSnapshot(snapshot: StoreSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    TOOL_EXECUTION_RUN_STORAGE_KEY,
    JSON.stringify({ ...snapshot, updatedAt: nowIso() }),
  )
  emitSync()
}

function appendHistory(
  history: ToolExecutionRunHistoryEntry[],
  status: ToolExecutionRunStatus,
  message: string | null = null,
): ToolExecutionRunHistoryEntry[] {
  return [
    ...history,
    {
      id: createId('terh'),
      status,
      at: nowIso(),
      message,
    },
  ]
}

function patchRun(
  id: string,
  patch: Partial<ToolExecutionRun> & { historyMessage?: string | null },
): ToolExecutionRun | null {
  const snapshot = readSnapshot()
  const index = snapshot.runs.findIndex((run) => run.id === id)
  if (index < 0) return null

  const existing = snapshot.runs[index]
  const history =
    patch.status && patch.status !== existing.status
      ? appendHistory(existing.history, patch.status, patch.historyMessage ?? null)
      : existing.history

  const now = nowIso()
  const next: ToolExecutionRun = {
    ...existing,
    ...patch,
    history,
    updatedAt: now,
  }

  const runs = [...snapshot.runs]
  runs[index] = next
  writeSnapshot({ ...snapshot, runs })
  return next
}

export function loadToolExecutionRuns(): ToolExecutionRun[] {
  return readSnapshot().runs
}

export function getToolExecutionRun(id: string): ToolExecutionRun | null {
  return loadToolExecutionRuns().find((run) => run.id === id) ?? null
}

export function listToolExecutionRuns(filter: ListToolExecutionRunsFilter = {}): ToolExecutionRun[] {
  let runs = loadToolExecutionRuns()

  if (filter.companyId) {
    runs = runs.filter((run) => run.companyId === filter.companyId)
  }
  if (filter.employeeId) {
    const canonical = resolveCanonicalEmployeeId(filter.employeeId)
    runs = runs.filter((run) => run.employeeId === canonical)
  }
  if (filter.toolId) {
    runs = runs.filter((run) => run.toolId === filter.toolId)
  }
  if (filter.workItemId) {
    runs = runs.filter((run) => run.workItemId === filter.workItemId)
  }
  if (filter.toolRequestId) {
    runs = runs.filter((run) => run.toolRequestId === filter.toolRequestId)
  }
  if (filter.delegationPlanId) {
    runs = runs.filter((run) => run.delegationPlanId === filter.delegationPlanId)
  }
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    runs = runs.filter((run) => statuses.includes(run.status))
  }

  return runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function createToolExecutionRun(input: CreateToolExecutionRunInput): ToolExecutionRun {
  const now = nowIso()
  const initialStatus = input.initialStatus ?? 'draft'
  const employeeId = resolveCanonicalEmployeeId(input.employeeId)

  const run: ToolExecutionRun = {
    id: createId('terun'),
    version: TOOL_EXECUTION_RUN_VERSION,
    companyId: input.companyId,
    employeeId,
    toolId: input.toolId,
    toolRequestId: input.toolRequestId,
    workItemId: input.workItemId,
    delegationPlanId: input.delegationPlanId ?? null,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    expectedResult: input.expectedResult?.trim() ?? '',
    fileScope: input.fileScope ?? [],
    checks: input.checks ?? [],
    status: initialStatus,
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    result: null,
    error: null,
    history: appendHistory([], initialStatus, 'Tool execution run created'),
  }

  const snapshot = readSnapshot()
  writeSnapshot({ ...snapshot, runs: [run, ...snapshot.runs] })
  return getToolExecutionRun(run.id) ?? run
}

export function approveToolExecutionRun(id: string, message?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'awaiting_owner') return null

  const now = nowIso()
  return patchRun(id, {
    status: 'approved',
    approvedAt: now,
    error: null,
    historyMessage: message?.trim() ?? 'Owner approved tool execution.',
  })
}

export function rejectToolExecutionRun(id: string, reason?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'awaiting_owner') return null

  return patchRun(id, {
    status: 'rejected',
    error: reason?.trim() ?? 'Rejected by Owner.',
    historyMessage: reason?.trim() ?? 'Owner rejected tool execution.',
  })
}

export function markToolExecutionQueued(id: string, message?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'approved') return null

  return patchRun(id, {
    status: 'queued',
    historyMessage: message?.trim() ?? 'Queued for external tool execution.',
  })
}

export function markToolExecutionRunning(id: string, message?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'queued') return null

  const now = nowIso()
  return patchRun(id, {
    status: 'running',
    startedAt: now,
    error: null,
    historyMessage: message?.trim() ?? 'External tool execution started.',
  })
}

export function recordToolExecutionResult(input: RecordToolExecutionResultInput): ToolExecutionRun | null {
  const existing = getToolExecutionRun(input.runId)
  if (!existing || existing.status !== 'running') return null

  const now = nowIso()
  const result: ToolExecutionRunResult = {
    plannedOnly: input.plannedOnly ?? false,
    output: input.output,
    deliveryMode: input.deliveryMode ?? 'cursor_v1',
    cursorAutomationTaskId: input.cursorAutomationTaskId ?? null,
    registryInvokePlanId: input.registryInvokePlanId ?? null,
    receivedAt: now,
  }

  const received = patchRun(input.runId, {
    status: 'result_received',
    result,
    error: null,
    historyMessage: 'Tool result received.',
  })
  if (!received) return null

  return patchRun(input.runId, {
    status: 'awaiting_employee_review',
    historyMessage: 'Awaiting employee review of tool result.',
  })
}

export function requestToolExecutionRework(id: string, notes?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'awaiting_employee_review') return null

  return patchRun(id, {
    status: 'rework_requested',
    error: notes?.trim() ?? null,
    historyMessage: notes?.trim() ?? 'Employee requested tool execution rework.',
  })
}

export function acceptToolExecutionResult(id: string, message?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'awaiting_employee_review') return null

  const now = nowIso()
  return patchRun(id, {
    status: 'accepted',
    completedAt: now,
    error: null,
    historyMessage: message?.trim() ?? 'Employee accepted tool result.',
  })
}

export function failToolExecutionRun(id: string, error?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || TERMINAL_STATUSES.has(existing.status)) return null

  const now = nowIso()
  return patchRun(id, {
    status: 'failed',
    failedAt: now,
    error: error?.trim() ?? 'Tool execution failed.',
    historyMessage: error?.trim() ?? 'Tool execution failed.',
  })
}

export function cancelToolExecutionRun(id: string, reason?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || TERMINAL_STATUSES.has(existing.status)) return null

  return patchRun(id, {
    status: 'cancelled',
    error: reason?.trim() ?? 'Cancelled.',
    historyMessage: reason?.trim() ?? 'Tool execution cancelled.',
  })
}

export function clearToolExecutionRuns(): void {
  writeSnapshot(emptySnapshot())
}
