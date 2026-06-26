import {
  OLLAMA_PROVIDER_CAPABILITIES,
  resolveOllamaModelTag,
} from './runtimeCapabilities'
import {
  appendRuntimeLog,
  estimateTokensFromText,
  fetchWithRetry,
  formatRuntimeError,
  loadOllamaSettings,
  RuntimeExecutionMonitor,
  saveRuntimeHealthSnapshot,
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

const EXECUTION_TIMEOUT_MS = 120_000
const activeRuns = new Map<string, AbortController>()
let initialized = false
let lastHealth: ProviderHealthResult | null = null
let lastExecutionDurationMs: number | null = null
let lastEstimatedTokens: number | null = null

function settings() {
  return loadOllamaSettings()
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

export const ollamaRuntimeProvider: RuntimeProvider = {
  id: 'ollama',
  name: 'Ollama',
  capabilities: { ...OLLAMA_PROVIDER_CAPABILITIES },

  initialize() {
    initialized = true
    appendRuntimeLog({
      level: 'info',
      message: `Ollama provider initialized · ${settings().baseUrl}`,
      runId: null,
      providerId: 'ollama',
    })
  },

  async health() {
    const started = Date.now()
    const baseUrl = settings().baseUrl
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
      return await fetchTags(settings().baseUrl)
    } catch {
      return []
    }
  },

  async execute(request: RuntimeExecutionRequest): Promise<RuntimeExecutionResult> {
    const monitor = new RuntimeExecutionMonitor()
    monitor.start()
    const controller = new AbortController()
    activeRuns.set(request.runId, controller)
    const timeout = window.setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS)

    const modelTag =
      request.ollamaModelTag ??
      resolveOllamaModelTag(request.modelId) ??
      settings().defaultModelTag

    appendRuntimeLog({
      level: 'info',
      message: `Ollama execute started · ${modelTag}`,
      runId: request.runId,
      providerId: 'ollama',
    })

    try {
      const response = await fetchWithRetry(
        generateUrl(settings().baseUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelTag,
            prompt: request.prompt,
            stream: false,
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
      const promptTokens = payload.prompt_eval_count ?? estimateTokensFromText(request.prompt)
      const completionTokens = payload.eval_count ?? estimateTokensFromText(responseText)
      const executionDurationMs =
        payload.total_duration != null
          ? Math.round(payload.total_duration / 1_000_000)
          : monitor.finish()

      lastExecutionDurationMs = executionDurationMs
      lastEstimatedTokens = promptTokens + completionTokens

      appendRuntimeLog({
        level: 'success',
        message: `Ollama completed · ${completionTokens} completion tokens · ${executionDurationMs}ms`,
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
      const message = formatRuntimeError(error)
      appendRuntimeLog({
        level: 'error',
        message: `Ollama execution failed: ${message}`,
        runId: request.runId,
        providerId: 'ollama',
      })
      throw new Error(message)
    } finally {
      window.clearTimeout(timeout)
      activeRuns.delete(request.runId)
    }
  },

  cancel(runId: string) {
    const controller = activeRuns.get(runId)
    if (!controller) return false
    controller.abort()
    activeRuns.delete(runId)
    appendRuntimeLog({
      level: 'warn',
      message: `Ollama execution cancelled · ${runId}`,
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
