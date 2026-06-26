import type { RuntimeResult, RuntimeWarning } from '../runtimeResult'

export const RUNTIME_PROVIDER_IDS = [
  'mock',
  'ollama',
  'openrouter',
  'openai',
  'anthropic',
] as const

export type RuntimeProviderId = (typeof RUNTIME_PROVIDER_IDS)[number]

export type ProviderCapabilities = {
  streaming: boolean
  tools: boolean
  vision: boolean
  code: boolean
  embeddings: boolean
}

export type ProviderHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unavailable'
  | 'mock'
  | 'unknown'

export type ProviderHealthResult = {
  status: ProviderHealthStatus
  message: string
  checkedAt: string
  latencyMs?: number
  loadedModels?: string[]
}

export type ProviderStatusSnapshot = {
  providerId: RuntimeProviderId
  initialized: boolean
  lastHealth: ProviderHealthResult | null
  activeExecutionCount: number
  lastExecutionDurationMs?: number | null
  lastEstimatedTokens?: number | null
}

export type RuntimeExecutionRequest = {
  runId: string
  employeeId: string
  modelId: string
  catalogProviderId: string
  estimatedTokens: number
  contextSize: number
  knowledgeUsed: number
  memoryUsed: number
  warnings: RuntimeWarning[]
  prompt: string
  ollamaModelTag?: string | null
}

export type RuntimeExecutionResult = {
  result: RuntimeResult
  providerId: RuntimeProviderId
  mock: boolean
}

export interface RuntimeProvider {
  id: RuntimeProviderId
  name: string
  capabilities: ProviderCapabilities
  initialize(): void | Promise<void>
  health(): ProviderHealthResult | Promise<ProviderHealthResult>
  listModels?(): Promise<string[]> | string[]
  execute(request: RuntimeExecutionRequest): RuntimeExecutionResult | Promise<RuntimeExecutionResult>
  cancel(runId: string): boolean | Promise<boolean>
  status(): ProviderStatusSnapshot
}

export const CATALOG_PROVIDER_TO_ADAPTER: Record<string, RuntimeProviderId> = {
  'provider-local-mock': 'mock',
  'provider-ollama': 'ollama',
  'provider-openrouter': 'openrouter',
  'provider-openai': 'openai',
  'provider-anthropic': 'anthropic',
}

export function resolveAdapterIdFromCatalog(catalogProviderId: string): RuntimeProviderId {
  return CATALOG_PROVIDER_TO_ADAPTER[catalogProviderId] ?? 'mock'
}
