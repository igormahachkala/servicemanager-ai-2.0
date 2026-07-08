import {
  getOllamaGenerateOptions,
  isOllamaFastTestModel,
  OLLAMA_EXECUTION_TIMEOUT_MS,
  OLLAMA_PROVIDER_CAPABILITIES,
  resolveOllamaModelTag,
  trimPromptForFastTest,
} from './runtimeCapabilities'
import {
  appendRuntimeLog,
  createRuntimeExecutionError,
  estimateTokensFromText,
  fetchWithRetry,
  formatRuntimeError,
  getEffectiveOllamaBaseUrl,
  loadOllamaSettings,
  RuntimeExecutionMonitor,
  saveRuntimeHealthSnapshot,
  type RuntimeAbortReason,
  type RuntimeHealthSnapshot,
} from './runtimeHealth'
import type {
  ProviderHealthResult,
  ProviderStatusSnapshot,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeProvider,
} from './runtimeProvider'

type OllamaTagsResponse = {
  models?: Array<{ name?: string }>
}

type OllamaGenerateResponse = {
  response?: string
  eval_count?: number
  prompt_eval_count?: number
  total_duration?: number
  done?: boolean
  error?: string
}

type ActiveRun = {
  controller: AbortController
  abortReason: RuntimeAbortReason | null
  monitor: RuntimeExecutionMonitor
}

const activeRuns = new Map<string, ActiveRun>()
let initialized = false
let lastHealth: ProviderHealthResult | null = null
let lastExecutionDurationMs: number | null = null
let lastEstimatedTokens: number | null = null

function settings() {
  return loadOllamaSettings()
}

function effectiveBaseUrl() {
  return getEffectiveOllamaBaseUrl(settings())
}

function tagsUrl(baseUrl: string): string {
  return `${baseUrl}/api/tags`
}

function generateUrl(baseUrl: string): string {
  return `${baseUrl}/api/generate`
}

async function fetchTags(baseUrl: string): Promise<string[]> {
  const response = await fetchWithRetry(
    tagsUrl(baseUrl),
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    { retries: 2, retryDelayMs: 500 },
  )
  if (!response.ok) {
    throw new Error(`Ollama /api/tags failed with HTTP ${response.status}`)
  }
  const payload = (await response.json()) as OllamaTagsResponse
  return (payload.models ?? [])
    .map((item) => item.name)
    .filter((name): name is string => typeof name === 'string')
}

function persistHealth(snapshot: RuntimeHealthSnapshot, health: ProviderHealthResult): void {
  lastHealth = health
  saveRuntimeHealthSnapshot(snapshot)
}

function logExecutionFailure(
  runId: string,
  message: string,
  elapsedMs: number,
  level: 'error' | 'warn' = 'error',
): void {
  appendRuntimeLog({
    level,
    message: `Ollama execution stopped after ${elapsedMs}ms · ${message}`,
    runId,
    providerId: 'ollama',
  })
}

export const ollamaRuntimeProvider: RuntimeProvider = {
  id: 'ollama',
  name: 'Ollama',
  capabilities: { ...OLLAMA_PROVIDER_CAPABILITIES },

  initialize() {
    initialized = true
    appendRuntimeLog({
      level: 'info',
      message: `Ollama provider initialized · ${effectiveBaseUrl()}`,
      runId: null,
      providerId: 'ollama',
    })
  },

  async health() {
    const started = Date.now()
    const baseUrl = effectiveBaseUrl()
    try {
      const models = await fetchTags(baseUrl)
      const latencyMs = Date.now() - started
      const health: ProviderHealthResult = {
        status: models.length > 0 ? 'healthy' : 'degraded',
        message:
          models.length > 0
            ? `Ollama reachable · ${models.length} model(s) loaded`
            : 'Ollama reachable but no models reported',
        checkedAt: new Date().toISOString(),
        latencyMs,
        loadedModels: models,
      }
      persistHealth(
        {
          providerId: 'ollama',
          checkedAt: health.checkedAt,
          latencyMs,
          loadedModels: models,
          lastError: null,
          lastExecutionDurationMs,
          lastEstimatedTokens,
        },
        health,
      )
      return health
    } catch (error) {
      const message = formatRuntimeError(error)
      const health: ProviderHealthResult = {
        status: 'unavailable',
        message: `Ollama unavailable: ${message}`,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        loadedModels: [],
      }
      persistHealth(
        {
          providerId: 'ollama',
          checkedAt: health.checkedAt,
          latencyMs: health.latencyMs ?? 0,
          loadedModels: [],
          lastError: message,
          lastExecutionDurationMs,
          lastEstimatedTokens,
        },
        health,
      )
      appendRuntimeLog({
        level: 'error',
        message: health.message,
        runId: null,
        providerId: 'ollama',
      })
      return health
    }
  },

  async listModels() {
    try {
      return await fetchTags(effectiveBaseUrl())
    } catch {
      return []
    }
  },

  async execute(request: RuntimeExecutionRequest): Promise<RuntimeExecutionResult> {
    const monitor = new RuntimeExecutionMonitor()
    monitor.start()
    const controller = new AbortController()
    const activeRun: ActiveRun = { controller, abortReason: null, monitor }
    activeRuns.set(request.runId, activeRun)

    const timeout = window.setTimeout(() => {
      activeRun.abortReason = 'timeout'
      controller.abort()
    }, OLLAMA_EXECUTION_TIMEOUT_MS)

    const modelTag =
      request.ollamaModelTag ??
      resolveOllamaModelTag(request.modelId) ??
      settings().defaultModelTag
    const fastTestMode = isOllamaFastTestModel(modelTag)
    const prompt = trimPromptForFastTest(request.prompt, modelTag)
    const generateOptions = getOllamaGenerateOptions(modelTag)

    appendRuntimeLog({
      level: 'info',
      message: fastTestMode
        ? `Ollama fast test execute started · ${modelTag} · timeout ${OLLAMA_EXECUTION_TIMEOUT_MS / 1000}s`
        : `Ollama execute started · ${modelTag} · timeout ${OLLAMA_EXECUTION_TIMEOUT_MS / 1000}s`,
      runId: request.runId,
      providerId: 'ollama',
    })

    try {
      const response = await fetchWithRetry(
        generateUrl(effectiveBaseUrl()),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelTag,
            prompt,
            stream: false,
            options: generateOptions,
          }),
        },
        { retries: 1, retryDelayMs: 800 },
      )

      if (!response.ok) {
        throw new Error(`Ollama /api/generate failed with HTTP ${response.status}`)
      }

      const payload = (await response.json()) as OllamaGenerateResponse
      if (payload.error) {
        throw new Error(payload.error)
      }

      const responseText = payload.response?.trim() ?? ''
      const promptTokens = payload.prompt_eval_count ?? estimateTokensFromText(prompt)
      const completionTokens = payload.eval_count ?? estimateTokensFromText(responseText)
      const executionDurationMs =
        payload.total_duration != null
          ? Math.round(payload.total_duration / 1_000_000)
          : monitor.finish()

      lastExecutionDurationMs = executionDurationMs
      lastEstimatedTokens = promptTokens + completionTokens

      appendRuntimeLog({
        level: 'success',
        message: fastTestMode
          ? `Ollama fast test completed · ${completionTokens} completion tokens · ${executionDurationMs}ms`
          : `Ollama completed · ${completionTokens} completion tokens · ${executionDurationMs}ms`,
        runId: request.runId,
        providerId: 'ollama',
      })

      return {
        providerId: 'ollama',
        mock: false,
        result: {
          selectedModel: request.modelId,
          selectedProvider: request.catalogProviderId,
          contextSize: request.contextSize,
          knowledgeUsed: request.knowledgeUsed,
          memoryUsed: request.memoryUsed,
          estimatedCost: 0,
          estimatedTokens: promptTokens + completionTokens,
          promptTokens,
          completionTokens,
          executionDurationMs,
          responseText,
          ollamaModelTag: modelTag,
          warnings: request.warnings,
          artifacts: [
            {
              id: `artifact-response-${request.runId}`,
              kind: 'context_snapshot',
              label: 'Ollama response',
              refId: request.runId,
            },
          ],
        },
      }
    } catch (error) {
      const elapsedMs = monitor.elapsed()
      const abortReason = activeRun.abortReason
      const executionError = createRuntimeExecutionError(
        error,
        abortReason,
        elapsedMs,
        OLLAMA_EXECUTION_TIMEOUT_MS,
      )
      logExecutionFailure(
        request.runId,
        executionError.message,
        elapsedMs,
        abortReason === 'cancelled' ? 'warn' : 'error',
      )
      throw executionError
    } finally {
      window.clearTimeout(timeout)
      activeRuns.delete(request.runId)
    }
  },

  cancel(runId: string) {
    const activeRun = activeRuns.get(runId)
    if (!activeRun) return false
    activeRun.abortReason = 'cancelled'
    activeRun.controller.abort()
    appendRuntimeLog({
      level: 'warn',
      message: `Ollama cancel requested · ${runId}`,
      runId,
      providerId: 'ollama',
    })
    return true
  },

  status(): ProviderStatusSnapshot {
    return {
      providerId: 'ollama',
      initialized,
      lastHealth,
      activeExecutionCount: activeRuns.size,
      lastExecutionDurationMs,
      lastEstimatedTokens,
    }
  },
}

export { OLLAMA_EXECUTION_TIMEOUT_MS }
