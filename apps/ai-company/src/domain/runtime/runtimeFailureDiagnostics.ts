/**
 * Runtime failure diagnostics — captured for Worker Loop + Runtime Run (108D).
 * Additive only; does not change orchestration flow.
 */

import type { MaxWorkerLoopRecord } from '../maxWorkerLoop'
import {
  OLLAMA_LOCALHOST_ENDPOINT,
  resolveEffectiveOllamaBaseUrl,
  resolveOllamaBaseUrl,
} from './providers/ollamaSourceMode'
import { loadOllamaSettings, RuntimeExecutionError } from './providers/runtimeHealth'
import type { RuntimeRun } from './runtimeRun'

export type RuntimeFailureDiagnostics = {
  runtimeRunId: string | null
  workerLoopId: string | null
  phase: string | null
  model: string | null
  endpoint: string | null
  effectiveEndpoint: string | null
  provider: string | null
  httpStatus: number | null
  errorMessage: string | null
  errorName: string | null
  errorStack: string | null
  rawError: string | null
  createdAt: string
}

export type RuntimeFailureHint = 'network' | 'model_missing' | null

declare global {
  interface Window {
    __AI_COMPANY_DEBUG_LAST_RUNTIME_FAILURE__?: RuntimeFailureDiagnostics
  }
}

export function extractHttpStatusFromMessage(message: string | null | undefined): number | null {
  if (!message) return null
  const match = message.match(/HTTP\s+(\d{3})/i)
  if (!match) return null
  const code = Number.parseInt(match[1], 10)
  return Number.isFinite(code) ? code : null
}

function truncate(value: string | null, max = 1200): string | null {
  if (!value) return null
  return value.length <= max ? value : `${value.slice(0, max)}…`
}

function resolveOllamaEndpoints() {
  const settings = loadOllamaSettings()
  return {
    endpoint: resolveOllamaBaseUrl(settings),
    effectiveEndpoint: resolveEffectiveOllamaBaseUrl(settings),
  }
}

function failedLoopPhase(loop: MaxWorkerLoopRecord | null | undefined): string | null {
  if (!loop) return null
  const failed = loop.phases.find((item) => item.status === 'failed')
  if (failed?.phase) return failed.phase
  if (loop.status === 'failed') return loop.currentPhase
  return null
}

function failedRunPhase(run: RuntimeRun | null | undefined): string | null {
  if (!run) return null
  const failed = run.pipeline.find((item) => item.status === 'failed')
  if (failed?.id) return failed.id
  const complete = run.pipeline.find((item) => item.id === 'complete')
  if (complete?.status === 'failed') return 'complete'
  return null
}

export function extractRuntimeRunErrorMessage(run: RuntimeRun | null | undefined): string | null {
  if (!run) return null
  const complete = run.pipeline.find((item) => item.id === 'complete')
  if (complete?.status === 'failed' && complete.detail?.trim()) {
    return complete.detail.trim()
  }
  const failed = run.pipeline.find((item) => item.status === 'failed' && item.detail?.trim())
  if (failed?.detail) return failed.detail.trim()
  const warning = run.result?.warnings.find((item) => item.severity === 'error')
  if (warning?.message?.trim()) return warning.message.trim()
  return null
}

function resolveModelLabel(
  run: RuntimeRun | null | undefined,
  loop: MaxWorkerLoopRecord | null | undefined,
): string | null {
  const fromRun =
    run?.result?.resolvedOllamaTag?.trim() ||
    run?.result?.ollamaModelTag?.trim() ||
    run?.modelId?.trim() ||
    null
  if (fromRun) return fromRun
  const plan = loop?.decisionPlan
  return plan?.primaryModel?.ollamaTag?.trim() || plan?.primaryModel?.label?.trim() || null
}

function serializeRawError(error: unknown, run: RuntimeRun | null): string | null {
  if (error instanceof RuntimeExecutionError) {
    return truncate(
      JSON.stringify(
        {
          name: error.name,
          reason: error.reason,
          message: error.message,
          elapsedMs: error.elapsedMs,
          runStatus: run?.status ?? null,
          pipeline: run?.pipeline?.slice(-4) ?? null,
          warnings: run?.result?.warnings ?? null,
        },
        null,
        2,
      ),
    )
  }
  if (error instanceof Error) {
    return truncate(
      JSON.stringify(
        {
          name: error.name,
          message: error.message,
          stack: error.stack ?? null,
          runStatus: run?.status ?? null,
        },
        null,
        2,
      ),
    )
  }
  if (run) {
    return truncate(
      JSON.stringify(
        {
          runStatus: run.status,
          pipeline: run.pipeline,
          warnings: run.result?.warnings ?? null,
        },
        null,
        2,
      ),
    )
  }
  if (error == null) return null
  return truncate(String(error))
}

export function buildRuntimeFailureDiagnostics(input: {
  runtimeRunId?: string | null
  workerLoopId?: string | null
  phase?: string | null
  model?: string | null
  endpoint?: string | null
  effectiveEndpoint?: string | null
  provider?: string | null
  httpStatus?: number | null
  errorMessage?: string | null
  error?: unknown
  run?: RuntimeRun | null
  loop?: MaxWorkerLoopRecord | null
}): RuntimeFailureDiagnostics {
  const endpoints = resolveOllamaEndpoints()
  const run = input.run ?? null
  const loop = input.loop ?? null

  const errorMessage =
    input.errorMessage?.trim() ||
    extractRuntimeRunErrorMessage(run) ||
    loop?.errorMessage?.trim() ||
    (input.error instanceof Error ? input.error.message : null) ||
    null

  const httpStatus =
    input.httpStatus ??
    extractHttpStatusFromMessage(errorMessage) ??
    extractHttpStatusFromMessage(
      run?.result?.warnings.find((item) => item.severity === 'error')?.message,
    )

  const phase =
    input.phase ??
    failedLoopPhase(loop) ??
    failedRunPhase(run) ??
    (loop?.status === 'failed' ? loop.currentPhase : null)

  const model = input.model ?? resolveModelLabel(run, loop)

  return {
    runtimeRunId: input.runtimeRunId ?? run?.id ?? loop?.runtimeRunId ?? null,
    workerLoopId: input.workerLoopId ?? loop?.id ?? null,
    phase,
    model,
    endpoint: input.endpoint ?? endpoints.endpoint ?? OLLAMA_LOCALHOST_ENDPOINT,
    effectiveEndpoint: input.effectiveEndpoint ?? endpoints.effectiveEndpoint,
    provider: input.provider ?? run?.providerId ?? 'ollama',
    httpStatus,
    errorMessage,
    errorName:
      input.error instanceof Error ? input.error.name : errorMessage ? 'RuntimeFailure' : null,
    errorStack: input.error instanceof Error ? truncate(input.error.stack ?? null, 2000) : null,
    rawError: serializeRawError(input.error, run),
    createdAt: new Date().toISOString(),
  }
}

export function buildRuntimeFailureDiagnosticsFromRun(
  run: RuntimeRun,
  loop?: MaxWorkerLoopRecord | null,
  fallbackMessage?: string,
): RuntimeFailureDiagnostics {
  return buildRuntimeFailureDiagnostics({
    run,
    loop,
    runtimeRunId: run.id,
    workerLoopId: loop?.id ?? null,
    provider: run.providerId,
    errorMessage:
      extractRuntimeRunErrorMessage(run) ?? fallbackMessage ?? `Runtime status: ${run.status}`,
  })
}

export function inferRuntimeFailureHint(
  diagnostics: RuntimeFailureDiagnostics | null | undefined,
): RuntimeFailureHint {
  if (!diagnostics?.errorMessage) return null
  const text = diagnostics.errorMessage.toLowerCase()
  const raw = (diagnostics.rawError ?? '').toLowerCase()
  const combined = `${text} ${raw}`

  if (
    combined.includes('not found') &&
    (combined.includes('model') || combined.includes('модел') || combined.includes('pull'))
  ) {
    return 'model_missing'
  }
  if (
    diagnostics.httpStatus != null ||
    combined.includes('failed to fetch') ||
    combined.includes('network error') ||
    combined.includes('ollama') ||
    combined.includes('/api/tags') ||
    combined.includes('/runtime/ollama') ||
    combined.includes('typeerror')
  ) {
    return 'network'
  }
  return null
}

export function publishRuntimeFailureDebug(diagnostics: RuntimeFailureDiagnostics): void {
  if (typeof window === 'undefined') return
  window.__AI_COMPANY_DEBUG_LAST_RUNTIME_FAILURE__ = diagnostics
  console.warn('[AI Company] Runtime failure diagnostics', diagnostics)
}

export function parseRuntimeFailureDiagnostics(value: unknown): RuntimeFailureDiagnostics | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.createdAt !== 'string') return null
  return {
    runtimeRunId: typeof raw.runtimeRunId === 'string' ? raw.runtimeRunId : null,
    workerLoopId: typeof raw.workerLoopId === 'string' ? raw.workerLoopId : null,
    phase: typeof raw.phase === 'string' ? raw.phase : null,
    model: typeof raw.model === 'string' ? raw.model : null,
    endpoint: typeof raw.endpoint === 'string' ? raw.endpoint : null,
    effectiveEndpoint: typeof raw.effectiveEndpoint === 'string' ? raw.effectiveEndpoint : null,
    provider: typeof raw.provider === 'string' ? raw.provider : null,
    httpStatus: typeof raw.httpStatus === 'number' ? raw.httpStatus : null,
    errorMessage: typeof raw.errorMessage === 'string' ? raw.errorMessage : null,
    errorName: typeof raw.errorName === 'string' ? raw.errorName : null,
    errorStack: typeof raw.errorStack === 'string' ? raw.errorStack : null,
    rawError: typeof raw.rawError === 'string' ? raw.rawError : null,
    createdAt: raw.createdAt,
  }
}
