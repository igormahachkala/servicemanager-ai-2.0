import type { MaxWorkerLoopInput, MaxWorkerLoopPhaseProgress, MaxWorkerLoopRecord } from './maxWorkerLoop'
import {
  MAX_WORKER_LOOP_PHASES,
  MAX_WORKER_LOOP_SAFE_PHASES,
  MAX_WORKER_LOOP_VERSION,
  MAX_WORKER_EMPLOYEE_ID,
} from './maxWorkerLoop'

const STORAGE_KEY = 'ai-company-max-worker-loops'

/** V1: browser localStorage. V2: replace with MaxWorkerLoopStoragePort → server API. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePhaseProgress(value: unknown): MaxWorkerLoopPhaseProgress | null {
  if (!isRecord(value)) return null
  if (typeof value.phase !== 'string' || typeof value.status !== 'string') return null
  return {
    phase: value.phase as MaxWorkerLoopPhaseProgress['phase'],
    status: value.status as MaxWorkerLoopPhaseProgress['status'],
    detail: typeof value.detail === 'string' ? value.detail : undefined,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : undefined,
  }
}

function parseRecord(value: unknown): MaxWorkerLoopRecord | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.employeeId !== MAX_WORKER_EMPLOYEE_ID) return null
  const phases = Array.isArray(value.phases)
    ? value.phases.map(parsePhaseProgress).filter((item): item is MaxWorkerLoopPhaseProgress => item !== null)
    : []
  const input = value.input
  if (!isRecord(input) || typeof input.taskText !== 'string') return null

  return {
    id: value.id,
    version: MAX_WORKER_LOOP_VERSION,
    employeeId: MAX_WORKER_EMPLOYEE_ID,
    status: (value.status as MaxWorkerLoopRecord['status']) ?? 'draft',
    currentPhase: (value.currentPhase as MaxWorkerLoopRecord['currentPhase']) ?? 'owner_task',
    phases,
    input: {
      taskText: input.taskText,
      title: typeof input.title === 'string' ? input.title : undefined,
      projectId: typeof input.projectId === 'string' ? input.projectId : '',
      workspaceId: typeof input.workspaceId === 'string' ? input.workspaceId : '',
      priority: input.priority as MaxWorkerLoopInput['priority'],
      expectedOutput: typeof input.expectedOutput === 'string' ? input.expectedOutput : undefined,
      constraints: typeof input.constraints === 'string' ? input.constraints : undefined,
      mode: input.mode as MaxWorkerLoopInput['mode'],
      modelMode: input.modelMode as MaxWorkerLoopInput['modelMode'],
      autonomousDemoScenarioId:
        typeof input.autonomousDemoScenarioId === 'string' ? input.autonomousDemoScenarioId : null,
    },
    deliveryTaskId: typeof value.deliveryTaskId === 'string' ? value.deliveryTaskId : null,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    reportId: typeof value.reportId === 'string' ? value.reportId : null,
    taskRunnerRecordId: typeof value.taskRunnerRecordId === 'string' ? value.taskRunnerRecordId : null,
    safeMode: true,
    autonomousDemoScenarioId:
      typeof value.autonomousDemoScenarioId === 'string' ? value.autonomousDemoScenarioId : null,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
  }
}

export function loadMaxWorkerLoopRecords(): MaxWorkerLoopRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseRecord).filter((item): item is MaxWorkerLoopRecord => item !== null)
  } catch {
    return []
  }
}

export function saveMaxWorkerLoopRecords(records: MaxWorkerLoopRecord[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function upsertMaxWorkerLoopRecord(record: MaxWorkerLoopRecord): MaxWorkerLoopRecord {
  const records = loadMaxWorkerLoopRecords()
  const index = records.findIndex((item) => item.id === record.id)
  if (index >= 0) {
    records[index] = record
  } else {
    records.unshift(record)
  }
  saveMaxWorkerLoopRecords(records)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ai-company-max-worker-loop-sync'))
  }
  return record
}

export function getMaxWorkerLoopById(id: string): MaxWorkerLoopRecord | null {
  return loadMaxWorkerLoopRecords().find((item) => item.id === id) ?? null
}

export function getMaxWorkerLoopByRunId(runtimeRunId: string): MaxWorkerLoopRecord | null {
  return loadMaxWorkerLoopRecords().find((item) => item.runtimeRunId === runtimeRunId) ?? null
}

function buildInitialPhases(input: MaxWorkerLoopInput): MaxWorkerLoopPhaseProgress[] {
  const phases = input.autonomousDemoScenarioId ? MAX_WORKER_LOOP_PHASES : MAX_WORKER_LOOP_SAFE_PHASES
  return phases.map((phase) => ({
    phase,
    status: 'pending' as const,
  }))
}

export function createMaxWorkerLoopRecord(input: MaxWorkerLoopInput): MaxWorkerLoopRecord {
  const now = new Date().toISOString()
  const id = `max-loop-${Date.now()}`

  return {
    id,
    version: MAX_WORKER_LOOP_VERSION,
    employeeId: MAX_WORKER_EMPLOYEE_ID,
    status: 'draft',
    currentPhase: 'owner_task',
    phases: buildInitialPhases(input),
    input,
    deliveryTaskId: null,
    runtimeRunId: null,
    reportId: null,
    taskRunnerRecordId: null,
    safeMode: true,
    autonomousDemoScenarioId: input.autonomousDemoScenarioId ?? null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    errorMessage: null,
  }
}

export function updateMaxWorkerLoopPhase(
  record: MaxWorkerLoopRecord,
  phase: MaxWorkerLoopRecord['currentPhase'],
  status: MaxWorkerLoopPhaseProgress['status'],
  detail?: string,
): MaxWorkerLoopRecord {
  const now = new Date().toISOString()
  const phases = record.phases.map((item) => {
    if (item.phase !== phase) return item
    return {
      ...item,
      status,
      detail: detail ?? item.detail,
      completedAt: status === 'done' || status === 'skipped' ? now : item.completedAt,
    }
  })

  return {
    ...record,
    currentPhase: phase,
    phases,
    updatedAt: now,
  }
}
