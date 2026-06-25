import type {
  ProviderHealthResult,
  ProviderStatusSnapshot,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeProvider,
} from './runtimeProvider'

let initialized = false
let lastHealth: ProviderHealthResult | null = null

export const openRouterRuntimeProvider: RuntimeProvider = {
  id: 'openrouter',
  name: 'OpenRouter',
  capabilities: {
    streaming: true,
    tools: true,
    vision: false,
    code: true,
    embeddings: false,
  },

  initialize() {
    initialized = true
    lastHealth = {
      status: 'unavailable',
      message: 'OpenRouter adapter stub — API key and HTTP not enabled in V1.',
      checkedAt: new Date().toISOString(),
    }
  },

  health() {
    lastHealth = {
      status: 'unavailable',
      message: 'OpenRouter not connected — adapter stub only, no HTTP calls.',
      checkedAt: new Date().toISOString(),
    }
    return lastHealth
  },

  execute(request: RuntimeExecutionRequest): RuntimeExecutionResult {
    return {
      providerId: 'openrouter',
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
            message: 'OpenRouter adapter stub — switch to Mock provider or configure API in a future release.',
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
      providerId: 'openrouter',
      initialized,
      lastHealth,
      activeExecutionCount: 0,
    }
  },
}
