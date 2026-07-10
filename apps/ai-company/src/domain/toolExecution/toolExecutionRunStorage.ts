/**
 * Tool Execution Run — localStorage persistence (AI-COMPANY-113A).
 */

import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { migrateBuilderToolExecutionRunsToToolExecutionRuns } from './toolExecutionRunMigration'
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

function normalizeRun(run: ToolExecutionRun): ToolExecutionRun {
  return {
    ...run,
    workerLoopId: run.workerLoopId ?? null,
    builderToolDecisionId: run.builderToolDecisionId ?? null,
    legacyBuilderRunId: run.legacyBuilderRunId ?? null,
  }
}

function emptySnapshot(): StoreSnapshot {
  return { version: TOOL_EXECUTION_RUN_VERSION, runs: [], updatedAt: nowIso() }
}

let storageInitialized = false

function ensureStorageInitialized(): void {
  if (storageInitialized || typeof window === 'undefined') return
  migrateBuilderToolExecutionRunsToToolExecutionRuns()
  storageInitialized = true
}

function readSnapshot(): StoreSnapshot {
  ensureStorageInitialized()
  if (typeof window === 'undefined') return emptySnapshot()
  try {
    const raw = window.localStorage.getItem(TOOL_EXECUTION_RUN_STORAGE_KEY)
    if (!raw) return emptySnapshot()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== TOOL_EXECUTION_RUN_VERSION) return emptySnapshot()
    const runs = Array.isArray(parsed.runs)
      ? (parsed.runs as ToolExecutionRun[]).map(normalizeRun)
      : []
    return {
      version: TOOL_EXECUTION_RUN_VERSION,
      runs,
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
  return (
    loadToolExecutionRuns().find((run) => run.id === id || run.legacyBuilderRunId === id) ?? null
  )
}

export function getToolExecutionRunByWorkerLoopId(workerLoopId: string): ToolExecutionRun | null {
  return (
    listToolExecutionRuns({ workerLoopId }).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0] ?? null
  )
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
  if (filter.workerLoopId) {
    runs = runs.filter((run) => run.workerLoopId === filter.workerLoopId)
  }
  if (filter.builderToolDecisionId) {
    runs = runs.filter((run) => run.builderToolDecisionId === filter.builderToolDecisionId)
  }
  if (filter.legacyBuilderRunId) {
    runs = runs.filter((run) => run.legacyBuilderRunId === filter.legacyBuilderRunId)
  }
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    runs = runs.filter((run) => statuses.includes(run.status))
  }

  return runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function upsertToolExecutionRun(run: ToolExecutionRun): ToolExecutionRun {
  const snapshot = readSnapshot()
  const normalized = normalizeRun(run)
  const index = snapshot.runs.findIndex((item) => item.id === normalized.id)
  const runs = [...snapshot.runs]
  if (index >= 0) {
    runs[index] = normalized
  } else {
    runs.unshift(normalized)
  }
  writeSnapshot({ ...snapshot, runs })
  return normalized
}

export function createToolExecutionRun(input: CreateToolExecutionRunInput): ToolExecutionRun {
  const now = input.createdAt ?? nowIso()
  const initialStatus = input.initialStatus ?? 'draft'
  const employeeId = resolveCanonicalEmployeeId(input.employeeId)
  const history =
    input.history ??
    appendHistory([], initialStatus, 'Tool execution run created')

  const run: ToolExecutionRun = {
    id: input.id ?? createId('terun'),
    version: TOOL_EXECUTION_RUN_VERSION,
    companyId: input.companyId,
    employeeId,
    toolId: input.toolId,
    toolRequestId: input.toolRequestId,
    workItemId: input.workItemId,
    delegationPlanId: input.delegationPlanId ?? null,
    workerLoopId: input.workerLoopId ?? null,
    builderToolDecisionId: input.builderToolDecisionId ?? null,
    legacyBuilderRunId: input.legacyBuilderRunId ?? null,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    expectedResult: input.expectedResult?.trim() ?? '',
    fileScope: input.fileScope ?? [],
    checks: input.checks ?? [],
    status: initialStatus,
    createdAt: now,
    updatedAt: input.updatedAt ?? now,
    approvedAt: input.approvedAt ?? null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    result: null,
    error: null,
    history,
  }

  return upsertToolExecutionRun(run)
}

export function approveToolExecutionRun(id: string, message?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'awaiting_owner') return null

  const now = nowIso()
  return patchRun(existing.id, {
    status: 'approved',
    approvedAt: now,
    error: null,
    historyMessage: message?.trim() ?? 'Owner approved tool execution.',
  })
}

export function rejectToolExecutionRun(id: string, reason?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'awaiting_owner') return null

  return patchRun(existing.id, {
    status: 'rejected',
    error: reason?.trim() ?? 'Rejected by Owner.',
    historyMessage: reason?.trim() ?? 'Owner rejected tool execution.',
  })
}

export function markToolExecutionQueued(id: string, message?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'approved') return null

  return patchRun(existing.id, {
    status: 'queued',
    historyMessage: message?.trim() ?? 'Queued for external tool execution.',
  })
}

export function markToolExecutionRunning(id: string, message?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'queued') return null

  const now = nowIso()
  return patchRun(existing.id, {
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

  const received = patchRun(existing.id, {
    status: 'result_received',
    result,
    error: null,
    historyMessage: 'Tool result received.',
  })
  if (!received) return null

  return patchRun(existing.id, {
    status: 'awaiting_employee_review',
    historyMessage: 'Awaiting employee review of tool result.',
  })
}

/** Bridge path: queued or running → result_received (AI-COMPANY-113E). */
export function recordToolExecutionResultFromBridge(
  input: RecordToolExecutionResultInput,
): ToolExecutionRun | null {
  const existing = getToolExecutionRun(input.runId)
  if (!existing) return null

  if (existing.status === 'queued') {
    markToolExecutionRunning(input.runId, 'Cursor outbox result received.')
  }

  const afterRunning = getToolExecutionRun(input.runId)
  if (!afterRunning || afterRunning.status !== 'running') {
    if (
      afterRunning?.status === 'result_received' ||
      afterRunning?.status === 'awaiting_employee_review'
    ) {
      return afterRunning
    }
    return null
  }

  return recordToolExecutionResult(input)
}

export function requestToolExecutionRework(id: string, notes?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'awaiting_employee_review') return null

  return patchRun(existing.id, {
    status: 'rework_requested',
    error: notes?.trim() ?? null,
    historyMessage: notes?.trim() ?? 'Employee requested tool execution rework.',
  })
}

export function acceptToolExecutionResult(id: string, message?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || existing.status !== 'awaiting_employee_review') return null

  const now = nowIso()
  return patchRun(existing.id, {
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
  return patchRun(existing.id, {
    status: 'failed',
    failedAt: now,
    error: error?.trim() ?? 'Tool execution failed.',
    historyMessage: error?.trim() ?? 'Tool execution failed.',
  })
}

export function cancelToolExecutionRun(id: string, reason?: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(id)
  if (!existing || TERMINAL_STATUSES.has(existing.status)) return null

  return patchRun(existing.id, {
    status: 'cancelled',
    error: reason?.trim() ?? 'Cancelled.',
    historyMessage: reason?.trim() ?? 'Tool execution cancelled.',
  })
}

export function clearToolExecutionRuns(): void {
  writeSnapshot(emptySnapshot())
}

export function formatToolExecutionStatusLabel(status: ToolExecutionRunStatus): string {
  switch (status) {
    case 'draft':
      return 'Черновик'
    case 'awaiting_owner':
      return 'Ждёт решения Owner'
    case 'approved':
      return 'Cursor разрешён'
    case 'queued':
      return 'В очереди на Cursor'
    case 'running':
      return 'Cursor выполняется'
    case 'result_received':
    case 'awaiting_employee_review':
      return 'Результат получен'
    case 'accepted':
      return 'Результат принят'
    case 'rework_requested':
      return 'Запрошена доработка'
    case 'rejected':
      return 'Cursor отклонён'
    case 'failed':
      return 'Ошибка выполнения'
    case 'cancelled':
      return 'Отменено'
    default:
      return status
  }
}

export function initializeToolExecutionRunStorage(): void {
  ensureStorageInitialized()
}
