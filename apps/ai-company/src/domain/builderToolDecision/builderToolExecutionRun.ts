/**
 * Builder Tool Execution Run — Owner-gated lifecycle (AI-COMPANY-113B).
 */

import type {
  BuilderToolDecision,
  BuilderToolExecutionHistoryEntry,
  BuilderToolExecutionRun,
  BuilderToolExecutionRunStatus,
} from './builderToolDecisionTypes'
import { getBuilderToolDecisionById } from './builderToolDecisionStorage'

export const BUILDER_TOOL_EXECUTION_STORAGE_KEY = 'ai-company-builder-tool-execution-runs'

export const BUILDER_TOOL_EXECUTION_SYNC_EVENT = 'ai-company-builder-tool-execution-sync'

function nowIso(): string {
  return new Date().toISOString()
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(BUILDER_TOOL_EXECUTION_SYNC_EVENT))
}

function createRunId(): string {
  return `bter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function createHistoryId(): string {
  return `bteh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseHistoryEntry(value: unknown): BuilderToolExecutionHistoryEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.at !== 'string') return null
  if (
    value.kind !== 'tool_requested' &&
    value.kind !== 'tool_approved' &&
    value.kind !== 'tool_rejected'
  ) {
    return null
  }
  return {
    id: value.id,
    kind: value.kind,
    at: value.at,
    note: typeof value.note === 'string' ? value.note : null,
  }
}

function parseRun(value: unknown): BuilderToolExecutionRun | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.employeeId !== 'string') return null
  if (typeof value.workItemId !== 'string' || typeof value.workerLoopId !== 'string') return null
  if (typeof value.builderToolDecisionId !== 'string') return null
  if (typeof value.toolDispatcherRequestId !== 'string') return null
  if (value.recommendedToolId !== 'cursor') return null
  if (typeof value.taskTitle !== 'string') return null

  const status =
    value.status === 'awaiting_owner' ||
    value.status === 'approved' ||
    value.status === 'rejected' ||
    value.status === 'ready_for_adapter'
      ? value.status
      : null
  if (!status) return null

  const history = Array.isArray(value.history)
    ? value.history.map(parseHistoryEntry).filter((item): item is BuilderToolExecutionHistoryEntry => item !== null)
    : []

  return {
    id: value.id,
    employeeId: value.employeeId,
    workItemId: value.workItemId,
    workerLoopId: value.workerLoopId,
    builderToolDecisionId: value.builderToolDecisionId,
    toolDispatcherRequestId: value.toolDispatcherRequestId,
    recommendedToolId: 'cursor',
    taskTitle: value.taskTitle,
    status,
    history,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : nowIso(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso(),
    ownerDecisionAt: typeof value.ownerDecisionAt === 'string' ? value.ownerDecisionAt : null,
  }
}

export function loadBuilderToolExecutionRuns(): BuilderToolExecutionRun[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(BUILDER_TOOL_EXECUTION_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseRun)
      .filter((item): item is BuilderToolExecutionRun => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    return []
  }
}

function saveRuns(runs: BuilderToolExecutionRun[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BUILDER_TOOL_EXECUTION_STORAGE_KEY, JSON.stringify(runs))
  emitSync()
}

export function upsertBuilderToolExecutionRun(run: BuilderToolExecutionRun): BuilderToolExecutionRun {
  const list = loadBuilderToolExecutionRuns()
  const next = [run, ...list.filter((item) => item.id !== run.id)]
  saveRuns(next)
  return run
}

export function getBuilderToolExecutionRunById(id: string): BuilderToolExecutionRun | null {
  return loadBuilderToolExecutionRuns().find((item) => item.id === id) ?? null
}

export function getBuilderToolExecutionRunByWorkerLoopId(
  workerLoopId: string,
): BuilderToolExecutionRun | null {
  return loadBuilderToolExecutionRuns().find((item) => item.workerLoopId === workerLoopId) ?? null
}

export function listBuilderToolExecutionRunsForEmployee(employeeId: string): BuilderToolExecutionRun[] {
  return loadBuilderToolExecutionRuns().filter((item) => item.employeeId === employeeId)
}

export function listBuilderToolExecutionRunsAwaitingOwner(): BuilderToolExecutionRun[] {
  return loadBuilderToolExecutionRuns().filter((item) => item.status === 'awaiting_owner')
}

function appendHistory(
  run: BuilderToolExecutionRun,
  kind: BuilderToolExecutionHistoryEntry['kind'],
  note: string | null,
): BuilderToolExecutionRun {
  const at = nowIso()
  return {
    ...run,
    history: [{ id: createHistoryId(), kind, at, note }, ...run.history],
    updatedAt: at,
  }
}

export type CreateBuilderToolExecutionRunInput = {
  decision: BuilderToolDecision
  toolDispatcherRequestId: string
  taskTitle: string
}

export function createBuilderToolExecutionRun(
  input: CreateBuilderToolExecutionRunInput,
): BuilderToolExecutionRun {
  const now = nowIso()
  const run: BuilderToolExecutionRun = {
    id: createRunId(),
    employeeId: input.decision.employeeId,
    workItemId: input.decision.workItemId,
    workerLoopId: input.decision.workerLoopId,
    builderToolDecisionId: input.decision.id,
    toolDispatcherRequestId: input.toolDispatcherRequestId,
    recommendedToolId: 'cursor',
    taskTitle: input.taskTitle.trim() || 'Builder task',
    status: 'awaiting_owner',
    history: [
      {
        id: createHistoryId(),
        kind: 'tool_requested',
        at: now,
        note: input.decision.reason,
      },
    ],
    createdAt: now,
    updatedAt: now,
    ownerDecisionAt: null,
  }
  return upsertBuilderToolExecutionRun(run)
}

export function approveBuilderToolExecutionRun(runId: string): BuilderToolExecutionRun | null {
  const current = getBuilderToolExecutionRunById(runId)
  if (!current || current.status !== 'awaiting_owner') return null

  const decision = getBuilderToolDecisionById(current.builderToolDecisionId)
  const note = decision
    ? `Cursor разрешён Owner — ready for local adapter (${decision.fileScope.join(', ') || 'scope TBD'})`
    : 'Cursor разрешён Owner — ready for local adapter'

  let next = appendHistory(current, 'tool_approved', note)
  next = {
    ...next,
    status: 'ready_for_adapter',
    ownerDecisionAt: nowIso(),
  }
  return upsertBuilderToolExecutionRun(next)
}

export function rejectBuilderToolExecutionRun(
  runId: string,
  reason = 'Owner отклонил запрос Cursor',
): BuilderToolExecutionRun | null {
  const current = getBuilderToolExecutionRunById(runId)
  if (!current || current.status !== 'awaiting_owner') return null

  let next = appendHistory(current, 'tool_rejected', reason)
  next = {
    ...next,
    status: 'rejected',
    ownerDecisionAt: nowIso(),
  }
  return upsertBuilderToolExecutionRun(next)
}

export function formatBuilderToolExecutionStatusLabel(
  status: BuilderToolExecutionRunStatus,
): string {
  switch (status) {
    case 'awaiting_owner':
      return 'Ждёт решения Owner'
    case 'approved':
    case 'ready_for_adapter':
      return 'Cursor разрешён'
    case 'rejected':
      return 'Cursor отклонён'
    default:
      return status
  }
}
