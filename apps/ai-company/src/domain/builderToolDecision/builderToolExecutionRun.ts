/**
 * Builder Tool Execution Run — deprecated facade (AI-COMPANY-113D).
 * Canonical lifecycle: domain/toolExecution/ToolExecutionRun.
 */

import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry'
import {
  approveToolExecutionRun,
  formatToolExecutionStatusLabel,
  getToolExecutionRun,
  getToolExecutionRunByWorkerLoopId,
  listToolExecutionRuns,
  rejectToolExecutionRun,
} from '../toolExecution/toolExecutionRunStorage'
import type { ToolExecutionRun, ToolExecutionRunStatus } from '../toolExecution/toolExecutionRunTypes'
import type {
  BuilderToolDecision,
  BuilderToolExecutionHistoryEntry,
  BuilderToolExecutionRun,
  BuilderToolExecutionRunStatus,
} from './builderToolDecisionTypes'

export const BUILDER_TOOL_EXECUTION_STORAGE_KEY = 'ai-company-builder-tool-execution-runs'

/** @deprecated Use TOOL_EXECUTION_RUN_SYNC_EVENT */
export const BUILDER_TOOL_EXECUTION_SYNC_EVENT = 'ai-company-builder-tool-execution-sync'

function mapStatusToLegacy(status: ToolExecutionRunStatus): BuilderToolExecutionRunStatus {
  if (status === 'queued') return 'queued'
  if (status === 'result_received' || status === 'awaiting_employee_review') {
    return 'result_received'
  }
  if (status === 'approved' || status === 'running') {
    return 'ready_for_adapter'
  }
  if (status === 'awaiting_owner') return 'awaiting_owner'
  if (status === 'rejected') return 'rejected'
  return 'ready_for_adapter'
}

function mapHistoryToLegacy(run: ToolExecutionRun): BuilderToolExecutionHistoryEntry[] {
  const entries: BuilderToolExecutionHistoryEntry[] = []
  for (const item of run.history) {
    if (item.status === 'awaiting_owner') {
      entries.push({
        id: item.id,
        kind: 'tool_requested',
        at: item.at,
        note: item.message,
      })
    }
    if (item.status === 'approved') {
      entries.push({
        id: item.id,
        kind: 'tool_approved',
        at: item.at,
        note: item.message,
      })
    }
    if (item.status === 'rejected') {
      entries.push({
        id: item.id,
        kind: 'tool_rejected',
        at: item.at,
        note: item.message,
      })
    }
  }
  return entries
}

function mapToolExecutionRunToLegacy(run: ToolExecutionRun): BuilderToolExecutionRun {
  return {
    id: run.legacyBuilderRunId ?? run.id,
    employeeId: run.employeeId,
    workItemId: run.workItemId,
    workerLoopId: run.workerLoopId ?? '',
    builderToolDecisionId: run.builderToolDecisionId ?? '',
    toolDispatcherRequestId: run.toolRequestId,
    recommendedToolId: 'cursor',
    taskTitle: run.title,
    status: mapStatusToLegacy(run.status),
    history: mapHistoryToLegacy(run),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    ownerDecisionAt: run.approvedAt,
  }
}

function listBuilderRunsFromCanonical(): ToolExecutionRun[] {
  return listToolExecutionRuns({ employeeId: BUILDER_EMPLOYEE_ID }).filter(
    (run) => run.builderToolDecisionId !== null,
  )
}

/** @deprecated Use loadToolExecutionRuns */
export function loadBuilderToolExecutionRuns(): BuilderToolExecutionRun[] {
  return listBuilderRunsFromCanonical().map(mapToolExecutionRunToLegacy)
}

/** @deprecated Use upsertToolExecutionRun */
export function upsertBuilderToolExecutionRun(run: BuilderToolExecutionRun): BuilderToolExecutionRun {
  return run
}

/** @deprecated Use getToolExecutionRun */
export function getBuilderToolExecutionRunById(id: string): BuilderToolExecutionRun | null {
  const run = getToolExecutionRun(id)
  return run ? mapToolExecutionRunToLegacy(run) : null
}

/** @deprecated Use getToolExecutionRunByWorkerLoopId */
export function getBuilderToolExecutionRunByWorkerLoopId(
  workerLoopId: string,
): BuilderToolExecutionRun | null {
  const run = getToolExecutionRunByWorkerLoopId(workerLoopId)
  return run ? mapToolExecutionRunToLegacy(run) : null
}

/** @deprecated Use listToolExecutionRuns */
export function listBuilderToolExecutionRunsForEmployee(employeeId: string): BuilderToolExecutionRun[] {
  return listToolExecutionRuns({ employeeId })
    .filter((run) => run.builderToolDecisionId !== null)
    .map(mapToolExecutionRunToLegacy)
}

/** @deprecated Use listToolExecutionRuns({ status: 'awaiting_owner' }) */
export function listBuilderToolExecutionRunsAwaitingOwner(): BuilderToolExecutionRun[] {
  return listToolExecutionRuns({ status: 'awaiting_owner', employeeId: BUILDER_EMPLOYEE_ID })
    .filter((run) => run.builderToolDecisionId !== null)
    .map(mapToolExecutionRunToLegacy)
}

export type CreateBuilderToolExecutionRunInput = {
  decision: BuilderToolDecision
  toolDispatcherRequestId: string
  taskTitle: string
}

/** @deprecated Use submitBuilderCursorToolRequest → ToolExecutionRun */
export function createBuilderToolExecutionRun(
  _input: CreateBuilderToolExecutionRunInput,
): BuilderToolExecutionRun {
  throw new Error(
    'createBuilderToolExecutionRun is deprecated (113D). Use submitBuilderCursorToolRequest.',
  )
}

/** @deprecated Use approveToolExecutionRun */
export function approveBuilderToolExecutionRun(runId: string): BuilderToolExecutionRun | null {
  const approved = approveToolExecutionRun(
    runId,
    'Cursor разрешён Owner — ready for local adapter',
  )
  return approved ? mapToolExecutionRunToLegacy(approved) : null
}

/** @deprecated Use rejectToolExecutionRun */
export function rejectBuilderToolExecutionRun(
  runId: string,
  reason = 'Owner отклонил запрос Cursor',
): BuilderToolExecutionRun | null {
  const rejected = rejectToolExecutionRun(runId, reason)
  return rejected ? mapToolExecutionRunToLegacy(rejected) : null
}

/** @deprecated Use formatToolExecutionStatusLabel */
export function formatBuilderToolExecutionStatusLabel(
  status: BuilderToolExecutionRunStatus,
): string {
  if (status === 'ready_for_adapter' || status === 'approved') {
    return formatToolExecutionStatusLabel('approved')
  }
  if (status === 'awaiting_owner') {
    return formatToolExecutionStatusLabel('awaiting_owner')
  }
  if (status === 'rejected') {
    return formatToolExecutionStatusLabel('rejected')
  }
  return status
}
