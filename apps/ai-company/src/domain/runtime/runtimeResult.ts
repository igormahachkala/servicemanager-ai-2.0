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
  warnings: RuntimeWarning[]
  artifacts: RuntimeArtifact[]
}
