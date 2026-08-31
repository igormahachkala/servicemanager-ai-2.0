/**
 * Local analysis run: prompt -> model -> ExecutionResultEnvelope.
 *
 * Lives beside the ToolExecutionRun rather than inside the dispatcher because
 * the call is async while both dispatch entry points are synchronous — the same
 * split Cursor uses (dispatcher plans, cursorAutomationRunner executes).
 *
 * Every failure that reached the model produces an envelope, so a failed run
 * leaves evidence exactly as a rejected one does. Which envelope depends on what
 * actually broke: a dead or erroring endpoint is TRANSPORT_FAILED, while an
 * empty generation is DISPATCHED + FAILED — HTTP 200 with a fully read stream is
 * not a transport failure. The only outcome without an envelope is an endpoint
 * that could not be resolved at all, where nothing was ever attempted.
 */

import {
  createAnalysisRejectedEnvelope,
  createAnalysisResultEnvelope,
  createTransportFailureEnvelope,
} from '../cursorResultEnvelope'
import {
  buildToolDispatcherEndpointUrl,
  getToolDispatcherEndpointConfig,
} from '../toolDispatcher/toolDispatcherConfig'
import { callOllamaGenerate } from './ollamaAnalysisClient'
import { buildOllamaAnalysisPrompt, OLLAMA_ANALYSIS_SYSTEM } from './ollamaAnalysisPrompt'
import { describeSectionFailure, validateAnalysisSections } from './ollamaAnalysisSections'
import {
  OLLAMA_ANALYSIS_DEFAULT_MODEL,
  OLLAMA_ANALYSIS_TIMEOUT_MS,
  type OllamaAnalysisOutcome,
  type OllamaAnalysisRequest,
} from './ollamaAnalysisTypes'

const ENV = import.meta.env ?? ({} as ImportMetaEnv)

function readEnv(key: string): string | undefined {
  const value = ENV[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function nowIso(): string {
  return new Date().toISOString()
}

/** Request wins, then config, then the benchmark default. */
export function resolveOllamaAnalysisModel(requested?: string | null): string {
  return requested?.trim() || readEnv('VITE_OLLAMA_ANALYSIS_MODEL') || OLLAMA_ANALYSIS_DEFAULT_MODEL
}

export async function runOllamaAnalysis(
  request: OllamaAnalysisRequest,
): Promise<OllamaAnalysisOutcome> {
  const model = resolveOllamaAnalysisModel(request.model)
  const timeoutMs = request.timeoutMs ?? OLLAMA_ANALYSIS_TIMEOUT_MS
  const startedAt = nowIso()

  const url = buildToolDispatcherEndpointUrl(getToolDispatcherEndpointConfig('ollama'), 'submit')
  if (!url) {
    return {
      ok: false,
      code: 'OLLAMA_UNAVAILABLE',
      message: 'No Ollama endpoint resolved from the dispatcher config',
      model,
      startedAt,
      failedAt: nowIso(),
    }
  }

  const generated = await callOllamaGenerate({
    url,
    model,
    system: OLLAMA_ANALYSIS_SYSTEM,
    prompt: buildOllamaAnalysisPrompt({
      title: request.title,
      instructions: request.instructions,
    }),
    timeoutMs,
    fetchImpl: request.fetchImpl,
  })

  if (!generated.ok) {
    const failedAt = nowIso()
    const failureMetadata = {
      analysisModel: model,
      analysisModelRequested: model,
      sectionsValidated: false,
      transport: 'local_ollama_analysis',
    }
    const errors = [
      {
        code: generated.code,
        message: generated.message,
        terminal: true,
      },
    ]

    // An empty generation is NOT a transport failure: HTTP 200, the stream was
    // read to the end, and the model simply produced nothing. Calling it
    // TRANSPORT_FAILED would repeat the lie block 3 avoided, so it takes the
    // DISPATCHED + FAILED shape the rejected-analysis factory already gives.
    const envelope =
      generated.code === 'OLLAMA_EMPTY_RESPONSE'
        ? createAnalysisRejectedEnvelope({
            toolExecutionRunId: request.toolExecutionRunId,
            summary: '',
            errors: errors.map((error) => ({ ...error, source: 'execution' as const })),
            startedAt,
            finishedAt: failedAt,
            metadata: failureMetadata,
          })
        : createTransportFailureEnvelope({
            toolExecutionRunId: request.toolExecutionRunId,
            route: 'LOCAL_OLLAMA_ANALYSIS',
            errors: errors.map((error) => ({ ...error, source: 'transport' as const })),
            startedAt,
            finishedAt: failedAt,
            metadata: failureMetadata,
          })

    return {
      ok: false,
      code: generated.code,
      message: generated.message,
      model,
      startedAt,
      failedAt,
      envelope,
    }
  }

  const sections = validateAnalysisSections(generated.text)
  const finishedAt = nowIso()

  const metadata = {
    analysisModel: generated.model,
    analysisModelRequested: model,
    sectionsValidated: sections.ok,
    analysisSections: { missing: sections.missing, empty: sections.empty },
    // Telemetry for Cost Guard and load measurement. A null means Ollama did
    // not report that counter, not that the work was free.
    analysisMetrics: generated.metrics,
  }

  // An answer that misses the contract is not a success. The envelope still gets
  // built — the run reached the model and its text is evidence — but as FAILED.
  if (!sections.ok) {
    const reason = describeSectionFailure(sections)

    return {
      ok: false,
      code: 'OLLAMA_SECTIONS_INVALID',
      message: `Analysis did not satisfy the section contract — ${reason}`,
      model,
      startedAt,
      failedAt: finishedAt,
      text: generated.text,
      sections,
      envelope: createAnalysisRejectedEnvelope({
        toolExecutionRunId: request.toolExecutionRunId,
        summary: generated.text,
        errors: [
          {
            code: 'ANALYSIS_SECTIONS_INVALID',
            message: reason,
            source: 'validation',
            terminal: true,
          },
        ],
        startedAt,
        finishedAt,
        metadata,
      }),
    }
  }

  const envelope = createAnalysisResultEnvelope({
    toolExecutionRunId: request.toolExecutionRunId,
    summary: generated.text,
    startedAt,
    finishedAt,
    metadata,
  })

  return { ok: true, envelope, model: generated.model, text: generated.text, sections }
}
