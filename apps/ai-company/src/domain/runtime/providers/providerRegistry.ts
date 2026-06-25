import type {
  ProviderCapabilities,
  ProviderHealthResult,
  ProviderStatusSnapshot,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeProvider,
  RuntimeProviderId,
} from './runtimeProvider'
import { mockRuntimeProvider } from './mockProvider'
import { ollamaRuntimeProvider } from './ollamaProvider'
import { openRouterRuntimeProvider } from './openRouterProvider'

function createCloudStubProvider(
  id: Extract<RuntimeProviderId, 'openai' | 'anthropic'>,
  name: string,
  capabilities: ProviderCapabilities,
): RuntimeProvider {
  let initialized = false
  let lastHealth: ProviderHealthResult | null = null

  return {
    id,
    name,
    capabilities,
    initialize() {
      initialized = true
      lastHealth = {
        status: 'unavailable',
        message: `${name} adapter stub — not connected in V1.`,
        checkedAt: new Date().toISOString(),
      }
    },
    health() {
      lastHealth = {
        status: 'unavailable',
        message: `${name} not connected — adapter stub only.`,
        checkedAt: new Date().toISOString(),
      }
      return lastHealth
    },
    execute(request: RuntimeExecutionRequest): RuntimeExecutionResult {
      return {
        providerId: id,
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
              message: `${name} adapter stub — switch to Mock provider in V1.`,
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
        providerId: id,
        initialized,
        lastHealth,
        activeExecutionCount: 0,
      }
    },
  }
}

const openAiRuntimeProvider = createCloudStubProvider('openai', 'OpenAI', {
  streaming: true,
  tools: true,
  vision: true,
  code: true,
  embeddings: true,
})

const anthropicRuntimeProvider = createCloudStubProvider('anthropic', 'Anthropic', {
  streaming: true,
  tools: true,
  vision: true,
  code: true,
  embeddings: false,
})

const PROVIDERS: Record<RuntimeProviderId, RuntimeProvider> = {
  mock: mockRuntimeProvider,
  ollama: ollamaRuntimeProvider,
  openrouter: openRouterRuntimeProvider,
  openai: openAiRuntimeProvider,
  anthropic: anthropicRuntimeProvider,
}

export function listRuntimeProviders(): RuntimeProvider[] {
  return Object.values(PROVIDERS)
}

export function getRuntimeProvider(id: RuntimeProviderId): RuntimeProvider {
  return PROVIDERS[id]
}

export function isRuntimeProviderId(value: string): value is RuntimeProviderId {
  return value in PROVIDERS
}
