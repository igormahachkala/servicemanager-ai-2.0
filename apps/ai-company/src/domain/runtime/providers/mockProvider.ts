import { getModelById } from '../runtimeStorage'
import type {
  ProviderHealthResult,
  ProviderStatusSnapshot,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeProvider,
} from './runtimeProvider'

function estimateCost(modelId: string, tokens: number): number {
  const model = getModelById(modelId)
  if (!model || model.costPer1kTokens === null) return 0
  return (tokens / 1000) * model.costPer1kTokens
}

let initialized = false
let lastHealth: ProviderHealthResult | null = null
const activeRuns = new Set<string>()

export const mockRuntimeProvider: RuntimeProvider = {
  id: 'mock',
  name: 'Local Mock',
  capabilities: {
    streaming: true,
    tools: false,
    vision: false,
    code: false,
    embeddings: false,
  },

  initialize() {
    initialized = true
    lastHealth = {
      status: 'mock',
      message: 'Mock provider ready — no external inference.',
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
    }
  },

  health() {
    const checkedAt = new Date().toISOString()
    lastHealth = {
      status: 'mock',
      message: 'Mock provider operational — deterministic local execution.',
      checkedAt,
      latencyMs: 1,
    }
    return lastHealth
  },

  execute(request: RuntimeExecutionRequest): RuntimeExecutionResult {
    activeRuns.add(request.runId)

    const warnings = [...request.warnings]
    if (!warnings.some((item) => item.code === 'MOCK_EXECUTION')) {
      warnings.push({
        code: 'MOCK_EXECUTION',
        message: 'Mock provider execution — no LLM inference.',
        severity: 'info',
      })
    }

    const result: RuntimeExecutionResult = {
      providerId: 'mock',
      mock: true,
      result: {
        selectedModel: request.modelId,
        selectedProvider: request.catalogProviderId,
        contextSize: request.contextSize,
        knowledgeUsed: request.knowledgeUsed,
        memoryUsed: request.memoryUsed,
        estimatedCost: estimateCost(request.modelId, request.estimatedTokens),
        estimatedTokens: request.estimatedTokens,
        warnings,
        artifacts: [
          {
            id: `artifact-ctx-${request.runId}`,
            kind: 'context_snapshot',
            label: 'Context snapshot',
            refId: request.runId,
          },
        ],
      },
    }

    activeRuns.delete(request.runId)
    return result
  },

  cancel(runId: string) {
    return activeRuns.delete(runId)
  },

  status(): ProviderStatusSnapshot {
    return {
      providerId: 'mock',
      initialized,
      lastHealth,
      activeExecutionCount: activeRuns.size,
    }
  },
}
