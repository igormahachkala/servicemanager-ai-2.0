/**
 * BuilderToolExecutionRun → ToolExecutionRun migration (AI-COMPANY-113D).
 * Idempotent: matches by toolRequestId, workerLoopId+workItemId, legacyBuilderRunId.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import { BUILDER_TOOL_EXECUTION_STORAGE_KEY } from '../builderToolDecision/builderToolExecutionRun'
import type { BuilderToolExecutionRun } from '../builderToolDecision/builderToolDecisionTypes'
import { getBuilderToolDecisionById } from '../builderToolDecision/builderToolDecisionStorage'
import {
  TOOL_EXECUTION_RUN_STORAGE_KEY,
  TOOL_EXECUTION_RUN_VERSION,
  type ToolExecutionRun,
  type ToolExecutionRunHistoryEntry,
  type ToolExecutionRunStatus,
} from './toolExecutionRunTypes'

const MIGRATION_MARKER_KEY = 'ai-company-builder-tool-execution-runs-migrated-v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseLegacyRun(value: unknown): BuilderToolExecutionRun | null {
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
    history: Array.isArray(value.history)
      ? value.history
          .map((entry) => {
            if (!isRecord(entry)) return null
            if (typeof entry.id !== 'string' || typeof entry.at !== 'string') return null
            if (
              entry.kind !== 'tool_requested' &&
              entry.kind !== 'tool_approved' &&
              entry.kind !== 'tool_rejected'
            ) {
              return null
            }
            return {
              id: entry.id,
              kind: entry.kind,
              at: entry.at,
              note: typeof entry.note === 'string' ? entry.note : null,
            }
          })
          .filter((item): item is BuilderToolExecutionRun['history'][number] => item !== null)
      : [],
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    ownerDecisionAt: typeof value.ownerDecisionAt === 'string' ? value.ownerDecisionAt : null,
  }
}

function loadLegacyBuilderRuns(): BuilderToolExecutionRun[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(BUILDER_TOOL_EXECUTION_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseLegacyRun)
      .filter((item): item is BuilderToolExecutionRun => item !== null)
  } catch {
    return []
  }
}

function mapLegacyStatus(status: BuilderToolExecutionRun['status']): ToolExecutionRunStatus {
  if (status === 'ready_for_adapter') return 'approved'
  if (status === 'approved') return 'approved'
  return status
}

function mapLegacyHistory(run: BuilderToolExecutionRun): ToolExecutionRunHistoryEntry[] {
  const entries: ToolExecutionRunHistoryEntry[] = [
    {
      id: `terh-mig-${run.id}-created`,
      status: 'awaiting_owner',
      at: run.createdAt,
      message: 'Migrated from BuilderToolExecutionRun (113D).',
    },
  ]

  for (const entry of run.history) {
    if (entry.kind === 'tool_requested') {
      entries.push({
        id: `terh-mig-${entry.id}`,
        status: 'awaiting_owner',
        at: entry.at,
        message: entry.note,
      })
    }
    if (entry.kind === 'tool_approved') {
      entries.push({
        id: `terh-mig-${entry.id}`,
        status: 'approved',
        at: entry.at,
        message: entry.note,
      })
    }
    if (entry.kind === 'tool_rejected') {
      entries.push({
        id: `terh-mig-${entry.id}`,
        status: 'rejected',
        at: entry.at,
        message: entry.note,
      })
    }
  }

  const mappedStatus = mapLegacyStatus(run.status)
  if (mappedStatus !== 'awaiting_owner' && !entries.some((item) => item.status === mappedStatus)) {
    entries.push({
      id: `terh-mig-${run.id}-status`,
      status: mappedStatus,
      at: run.ownerDecisionAt ?? run.updatedAt,
      message: `Migrated status: ${run.status}`,
    })
  }

  return entries.sort((a, b) => a.at.localeCompare(b.at))
}

function findExistingRun(
  runs: ToolExecutionRun[],
  legacy: BuilderToolExecutionRun,
): ToolExecutionRun | null {
  return (
    runs.find((run) => run.legacyBuilderRunId === legacy.id) ??
    runs.find((run) => run.toolRequestId === legacy.toolDispatcherRequestId) ??
    runs.find(
      (run) =>
        run.workerLoopId === legacy.workerLoopId && run.workItemId === legacy.workItemId,
    ) ??
    null
  )
}

function convertLegacyRun(legacy: BuilderToolExecutionRun): ToolExecutionRun {
  const decision = getBuilderToolDecisionById(legacy.builderToolDecisionId)
  const status = mapLegacyStatus(legacy.status)
  const history = mapLegacyHistory(legacy)

  return {
    id: `terun-mig-${legacy.id}`,
    version: TOOL_EXECUTION_RUN_VERSION,
    companyId: DEFAULT_COMPANY_ID,
    employeeId: legacy.employeeId,
    toolId: 'cursor',
    toolRequestId: legacy.toolDispatcherRequestId,
    workItemId: legacy.workItemId,
    delegationPlanId: decision?.decisionPlanId ?? null,
    workerLoopId: legacy.workerLoopId,
    builderToolDecisionId: legacy.builderToolDecisionId,
    legacyBuilderRunId: legacy.id,
    title: legacy.taskTitle,
    instructions: decision?.reason ?? legacy.taskTitle,
    expectedResult: decision?.expectedResult ?? '',
    fileScope: decision?.fileScope ?? [],
    checks: decision?.checks ?? [],
    status,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    approvedAt: legacy.ownerDecisionAt,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    result: null,
    error: status === 'rejected' ? 'Rejected by Owner (migrated).' : null,
    history,
  }
}

type StoreSnapshot = {
  version: typeof TOOL_EXECUTION_RUN_VERSION
  runs: ToolExecutionRun[]
  updatedAt: string
}

function readCanonicalSnapshot(): StoreSnapshot {
  if (typeof window === 'undefined') {
    return { version: TOOL_EXECUTION_RUN_VERSION, runs: [], updatedAt: new Date().toISOString() }
  }
  try {
    const raw = window.localStorage.getItem(TOOL_EXECUTION_RUN_STORAGE_KEY)
    if (!raw) {
      return { version: TOOL_EXECUTION_RUN_VERSION, runs: [], updatedAt: new Date().toISOString() }
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== TOOL_EXECUTION_RUN_VERSION) {
      return { version: TOOL_EXECUTION_RUN_VERSION, runs: [], updatedAt: new Date().toISOString() }
    }
    return {
      version: TOOL_EXECUTION_RUN_VERSION,
      runs: Array.isArray(parsed.runs) ? (parsed.runs as ToolExecutionRun[]) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return { version: TOOL_EXECUTION_RUN_VERSION, runs: [], updatedAt: new Date().toISOString() }
  }
}

function writeCanonicalSnapshot(snapshot: StoreSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    TOOL_EXECUTION_RUN_STORAGE_KEY,
    JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }),
  )
}

let migrationDone = false

/** Migrate legacy BuilderToolExecutionRun records into canonical ToolExecutionRun storage. */
export function migrateBuilderToolExecutionRunsToToolExecutionRuns(): number {
  if (typeof window === 'undefined') return 0
  if (migrationDone) return 0
  if (window.localStorage.getItem(MIGRATION_MARKER_KEY) === 'done') {
    migrationDone = true
    return 0
  }

  const legacyRuns = loadLegacyBuilderRuns()
  if (legacyRuns.length === 0) {
    window.localStorage.setItem(MIGRATION_MARKER_KEY, 'done')
    migrationDone = true
    return 0
  }

  const snapshot = readCanonicalSnapshot()
  let migrated = 0

  for (const legacy of legacyRuns) {
    if (findExistingRun(snapshot.runs, legacy)) continue
    snapshot.runs.unshift(convertLegacyRun(legacy))
    migrated += 1
  }

  writeCanonicalSnapshot(snapshot)
  window.localStorage.removeItem(BUILDER_TOOL_EXECUTION_STORAGE_KEY)
  window.localStorage.setItem(MIGRATION_MARKER_KEY, 'done')
  migrationDone = true
  return migrated
}

/** Resolve terun id from legacy bter id after migration. */
export function resolveToolExecutionRunIdFromLegacyBuilderId(
  id: string,
  runs: ToolExecutionRun[],
): string {
  if (id.startsWith('terun-')) return id
  const byLegacy = runs.find((run) => run.legacyBuilderRunId === id)
  return byLegacy?.id ?? id
}
