import type {
  ProviderHealthResult,
  ProviderStatusSnapshot,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeProvider,
} from './runtimeProvider'

let initialized = false
let lastHealth: ProviderHealthResult | null = null

export const ollamaRuntimeProvider: RuntimeProvider = {
  id: 'ollama',
  name: 'Ollama',
  capabilities: {
    streaming: true,
    tools: true,
    vision: false,
    code: true,
    embeddings: true,
  },

  initialize() {
    initialized = true
    lastHealth = {
      status: 'unavailable',
      message: 'Ollama adapter stub — local HTTP not enabled in V1.',
      checkedAt: new Date().toISOString(),
    }
  },

  health() {
    lastHealth = {
      status: 'unavailable',
      message: 'Ollama not connected — adapter stub only, no HTTP calls.',
      checkedAt: new Date().toISOString(),
    }
    return lastHealth
  },

  execute(request: RuntimeExecutionRequest): RuntimeExecutionResult {
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
        estimatedTokens: request.estimatedTokens,
        warnings: [
          ...request.warnings,
          {
            code: 'PROVIDER_STUB',
            message: 'Ollama adapter stub — switch to Mock provider or enable Ollama in a future release.',
            severity: 'warn',
          },
        ],
        artifacts: [],
      },
    }
  },

  cancel() {
    return false
  },

  status(): ProviderStatusSnapshot {
    return {
      providerId: 'ollama',
      initialized,
      lastHealth,
      activeExecutionCount: 0,
    }
  },
}
