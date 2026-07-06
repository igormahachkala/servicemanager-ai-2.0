import type { CursorAutomationTask } from './cursorAutomation'

const STORAGE_KEY = 'ai-company-cursor-automation-runs'

export const CURSOR_AUTOMATION_SYNC_EVENT = 'ai-company-cursor-automation-sync'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseTask(value: unknown): CursorAutomationTask | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return null
  if (value.toolRegistryV1Id !== 'cursor-automation') return null
  return value as CursorAutomationTask
}

export function loadCursorAutomationRuns(): CursorAutomationTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseTask).filter((item): item is CursorAutomationTask => item !== null)
  } catch {
    return []
  }
}

export function saveCursorAutomationRuns(runs: CursorAutomationTask[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
  window.dispatchEvent(new Event(CURSOR_AUTOMATION_SYNC_EVENT))
}

export function getCursorAutomationRunById(id: string): CursorAutomationTask | null {
  return loadCursorAutomationRuns().find((item) => item.id === id) ?? null
}

export function getCursorAutomationRunByRuntimeRunId(runtimeRunId: string): CursorAutomationTask | null {
  return loadCursorAutomationRuns().find((item) => item.runtimeRunId === runtimeRunId) ?? null
}

export function upsertCursorAutomationRun(task: CursorAutomationTask): CursorAutomationTask {
  const runs = loadCursorAutomationRuns()
  const index = runs.findIndex((item) => item.id === task.id)
  if (index >= 0) {
    runs[index] = task
  } else {
    runs.unshift(task)
  }
  saveCursorAutomationRuns(runs)
  return task
}
