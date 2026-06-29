export type RuntimeArtifact = {
  id: string
  kind: 'report' | 'event' | 'context_snapshot'
  label: string
  refId: string
}

export type RuntimeWarning = {
  code: string
  message: string
  severity: 'info' | 'warn' | 'error'
}

export type RuntimeResult = {
  selectedModel: string
  selectedProvider: string
  contextSize: number
  knowledgeUsed: number
  memoryUsed: number
  estimatedCost: number
  estimatedTokens: number
  promptTokens?: number
  completionTokens?: number
  executionDurationMs?: number
  responseText?: string
  ollamaModelTag?: string
  runtimeProfileId?: string
  catalogModelLabel?: string
  resolvedOllamaTag?: string
  modelMode?: 'fast' | 'deep' | 'coding' | 'qa'
  estimatedSpeed?: 'fast' | 'medium' | 'slow'
  estimatedContext?: number
  expectedTimeoutMs?: number
  executionProviderId?: string
  fastTestMode?: boolean
  routingReason?: string
  warnings: RuntimeWarning[]
  artifacts: RuntimeArtifact[]
}
