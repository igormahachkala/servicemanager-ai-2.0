/**
 * Runtime Data Engineer — источники данных и граница demo vs real.
 *
 * TODO(runtime-data): mock provider (`mockProvider.ts`) — намеренный fallback без Ollama;
 *   замена возможна только после стабильного local Ollama в V1 acceptance.
 * TODO(runtime-data): cloud provider stubs (OpenAI/Anthropic) — не подключены к API по политике проекта.
 * TODO(runtime-data): knowledge onboarding corpus (`ensureSeedKnowledge`) — platform docs, не runtime output;
 *   заменяется items с тегом memory-evolution после real runs.
 * TODO(runtime-data): placeholder run artifacts — real file refs появятся после tool gateway + Codex CLI return path.
 */

import { loadEvents, saveEvents } from '../events/eventStorage'
import type { CompanyEvent } from '../events/event'
import type { Report } from '../reports/report'
import { loadReports, saveReports } from '../reports/reportStorage'
import { loadRunHistory, saveRunHistory } from '../run/runStorage'
import type { RunHistory } from '../run/runHistory'
import { syncRunHistoryFromRuntime } from '../run/runStorage'
import { loadRuntimeRuns } from './runtimeOrchestrator'
import type { RuntimeRun } from './runtimeRun'

/** Фиксированные demo-reports из `ensureSeedReports`. */
export const DEMO_REPORT_IDS = [
  'report-arch-v1',
  'report-qa-build',
  'report-devops-local',
  'report-ops-workspace',
  'report-system-foundation',
] as const

export function isRealRuntimeRunId(runId: string): boolean {
  return runId.startsWith('run-') && !runId.startsWith('run-seed-')
}

export function isDemoRunHistoryEntry(entry: RunHistory): boolean {
  if (entry.runtimeRunId?.startsWith('run-seed-')) return true
  if (entry.id.startsWith('run-hist-00')) return true
  return false
}

export function isRuntimeDerivedReport(report: Report): boolean {
  return report.id.startsWith('report-run-') || Boolean(report.runtimeBody)
}

export function isDemoReport(report: Report): boolean {
  return (DEMO_REPORT_IDS as readonly string[]).includes(report.id)
}

export function isDemoEvent(event: CompanyEvent): boolean {
  return /^evt-\d{3}$/.test(event.id)
}

export function loadRealRuntimeRuns(): RuntimeRun[] {
  return loadRuntimeRuns().filter((run) => isRealRuntimeRunId(run.id))
}

export function hasRealRuntimeRuns(): boolean {
  return loadRealRuntimeRuns().length > 0
}

export function hasRuntimeDerivedReports(): boolean {
  return loadReports().some(isRuntimeDerivedReport)
}

export function purgeDemoRunHistory(): void {
  const kept = loadRunHistory().filter((entry) => !isDemoRunHistoryEntry(entry))
  if (kept.length !== loadRunHistory().length) {
    saveRunHistory(kept)
  }
}

export function purgeDemoReports(): void {
  const kept = loadReports().filter((report) => !isDemoReport(report))
  if (kept.length !== loadReports().length) {
    saveReports(kept)
  }
}

export function purgeDemoEvents(): void {
  const kept = loadEvents().filter((event) => !isDemoEvent(event))
  if (kept.length !== loadEvents().length) {
    saveEvents(kept)
  }
}

/** Синхронизирует history/reports/events с real runtime и убирает demo-слой при наличии real runs. */
export function syncRuntimeDerivedStores(): void {
  syncRunHistoryFromRuntime()

  if (!hasRealRuntimeRuns()) return

  purgeDemoRunHistory()
  purgeDemoReports()
  purgeDemoEvents()
}

export function shouldSeedRunHistory(): boolean {
  syncRunHistoryFromRuntime()
  if (hasRealRuntimeRuns()) return false
  return loadRunHistory().length === 0
}

export function shouldSeedReports(): boolean {
  if (hasRealRuntimeRuns() || hasRuntimeDerivedReports()) return false
  return loadReports().length === 0
}

export function shouldSeedTimelineEvents(): boolean {
  if (hasRealRuntimeRuns()) return false
  return loadEvents().length === 0
}
