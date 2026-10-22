/**
 * Executes an approved ollama ToolExecutionRun — the link between a created run
 * and runOllamaAnalysis.
 *
 * Awaitable on purpose, and free of any `typeof window` guard: the ollama route
 * works headless since OLLAMA_BASE_URL landed, and a detached promise would let
 * a script or a cron exit mid-analysis. The browser trigger in
 * approveToolExecutionRun calls this and forgets; a headless caller awaits it
 * directly instead of going through approval.
 *
 * Transitions are the guarded ones Cursor already uses:
 *   approved -> queued -> running -> result_received -> awaiting_employee_review
 * A rejected analysis then goes on to `failed`, keeping the evidence it just
 * recorded: `awaiting_employee_review` is not in TERMINAL_STATUSES, so the
 * second write lands and the run ends up failed WITH the envelope attached.
 */

import { mapEnvelopeToToolResultOutput } from '../cursorResultEnvelope/cursorResultEnvelopeAdapters'
import {
  failToolExecutionRun,
  getToolExecutionRun,
  markToolExecutionQueued,
  markToolExecutionRunning,
  recordToolExecutionResult,
} from '../toolExecution/toolExecutionRunStorage'
import { runOllamaAnalysis } from './ollamaAnalysisRunner'
import { loadAnalysisFiles } from './ollamaAnalysisFiles'

export type QueueOllamaAnalysisOptions = {
  /** Injected by tests; production uses global fetch. */
  fetchImpl?: typeof fetch
  model?: string | null
  /** Injected by tests for the file reads (the Ollama fetch is fetchImpl). */
  filesFetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
}

export type QueueOllamaAnalysisOutcome = { ok: boolean; error: string | null }

export async function queueToolExecutionRunForOllamaAnalysis(
  runId: string,
  options: QueueOllamaAnalysisOptions = {},
): Promise<QueueOllamaAnalysisOutcome> {
  const existing = getToolExecutionRun(runId)

  if (!existing) {
    return { ok: false, error: `ToolExecutionRun ${runId} was not found.` }
  }
  if (existing.toolId !== 'ollama') {
    return { ok: false, error: `ToolExecutionRun ${runId} is not an ollama run.` }
  }
  if (existing.status !== 'approved') {
    return { ok: false, error: `ToolExecutionRun ${runId} must be approved.` }
  }

  if (!markToolExecutionQueued(runId, 'Queued for local Ollama analysis.')) {
    return { ok: false, error: `ToolExecutionRun ${runId} could not be queued.` }
  }
  if (!markToolExecutionRunning(runId, 'Local Ollama analysis started.')) {
    return { ok: false, error: `ToolExecutionRun ${runId} could not be started.` }
  }

  const files =
    existing.fileScope.length > 0
      ? await loadAnalysisFiles(existing.fileScope, { fetchImpl: options.filesFetchImpl })
      : undefined

  const outcome = await runOllamaAnalysis({
    toolExecutionRunId: runId,
    title: existing.title,
    instructions: existing.instructions,
    files,
    model: options.model ?? null,
    fetchImpl: options.fetchImpl,
  })

  if (outcome.ok) {
    recordToolExecutionResult({
      runId,
      output: mapEnvelopeToToolResultOutput(outcome.envelope),
      deliveryMode: 'local_analysis_v1',
      plannedOnly: false,
    })
    return { ok: true, error: null }
  }

  const error = `${outcome.code}: ${outcome.message}`

  // Every failure that reached the model carries an envelope — an off-format
  // answer, a dead endpoint, an empty generation alike. Record it first so the
  // evidence survives, then fail the run honestly. Only an unresolved endpoint
  // arrives without one, since nothing was attempted.
  if (outcome.envelope) {
    recordToolExecutionResult({
      runId,
      output: mapEnvelopeToToolResultOutput(outcome.envelope),
      deliveryMode: 'local_analysis_v1',
      plannedOnly: false,
    })
  }

  failToolExecutionRun(runId, error)
  return { ok: false, error }
}
