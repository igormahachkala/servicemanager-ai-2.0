/**
 * Local analysis run: prompt -> model -> ExecutionResultEnvelope.
 *
 * Lives beside the ToolExecutionRun rather than inside the dispatcher because
 * the call is async while both dispatch entry points are synchronous — the same
 * split Cursor uses (dispatcher plans, cursorAutomationRunner executes).
 *
 * A failure never produces an envelope: createAnalysisResultEnvelope can only
 * express SUCCEEDED, and createTransportFailureEnvelope is still typed to Cursor
 * routes. The caller turns a failed outcome into a rejected ToolResult.
 */

import { createAnalysisResultEnvelope } from '../cursorResultEnvelope'
import {
  buildToolDispatcherEndpointUrl,
  getToolDispatcherEndpointConfig,
} from '../toolDispatcher/toolDispatcherConfig'
import { callOllamaGenerate } from './ollamaAnalysisClient'
import { buildOllamaAnalysisPrompt, OLLAMA_ANALYSIS_SYSTEM } from './ollamaAnalysisPrompt'
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
    return {
      ok: false,
      code: generated.code,
      message: generated.message,
      model,
      startedAt,
      failedAt: nowIso(),
    }
  }

  const envelope = createAnalysisResultEnvelope({
    toolExecutionRunId: request.toolExecutionRunId,
    summary: generated.text,
    startedAt,
    finishedAt: nowIso(),
    metadata: {
      analysisModel: generated.model,
      analysisModelRequested: model,
      // Sections are asked for by the prompt but not parsed yet — block 3.
      sectionsValidated: false,
    },
  })

  return { ok: true, envelope, model: generated.model, text: generated.text }
}
