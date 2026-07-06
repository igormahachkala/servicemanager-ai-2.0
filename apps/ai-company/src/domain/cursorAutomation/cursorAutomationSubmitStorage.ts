import type { CursorAutomationSubmitRun } from './cursorAutomationSubmitRun'

const STORAGE_KEY = 'ai-company-cursor-automation-submit-runs'

export const CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT = 'ai-company-cursor-automation-submit-sync'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseSubmitRun(value: unknown): CursorAutomationSubmitRun | null {
  if (!isRecord(value)) return null
  if (typeof value.runId !== 'string' || typeof value.maxWorkerLoopId !== 'string') return null
  if (typeof value.submittedAt !== 'string' || !isRecord(value.handoffPayload)) return null
  return value as CursorAutomationSubmitRun
}

export function loadCursorAutomationSubmitRuns(): CursorAutomationSubmitRun[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseSubmitRun).filter((item): item is CursorAutomationSubmitRun => item !== null)
  } catch {
    return []
  }
}

export function saveCursorAutomationSubmitRuns(runs: CursorAutomationSubmitRun[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
  window.dispatchEvent(new Event(CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT))
}

export function getCursorAutomationSubmitRunById(runId: string): CursorAutomationSubmitRun | null {
  return loadCursorAutomationSubmitRuns().find((item) => item.runId === runId) ?? null
}

export function getCursorAutomationSubmitRunByLoopId(
  maxWorkerLoopId: string,
): CursorAutomationSubmitRun | null {
  return (
    loadCursorAutomationSubmitRuns().find((item) => item.maxWorkerLoopId === maxWorkerLoopId) ??
    null
  )
}

export function upsertCursorAutomationSubmitRun(
  run: CursorAutomationSubmitRun,
): CursorAutomationSubmitRun {
  const runs = loadCursorAutomationSubmitRuns()
  const index = runs.findIndex((item) => item.runId === run.runId)
  if (index >= 0) {
    runs[index] = run
  } else {
    runs.unshift(run)
  }
  saveCursorAutomationSubmitRuns(runs)
  return run
}
