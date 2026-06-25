export const PROVIDER_TYPES = ['local', 'cloud', 'hybrid'] as const
export type ProviderType = (typeof PROVIDER_TYPES)[number]

export const CONNECTION_STATUSES = ['connected', 'disconnected', 'degraded', 'mock'] as const
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number]

export const PRIVACY_LEVELS = ['local-only', 'hybrid', 'cloud-ok'] as const
export type PrivacyLevel = (typeof PRIVACY_LEVELS)[number]

export type RuntimeModel = {
  id: string
  name: string
  providerId: string
  contextWindow: number
  maxOutputTokens: number
  costPer1kTokens: number | null
}

export type ModelProvider = {
  id: string
  name: string
  type: ProviderType
  connectionStatus: ConnectionStatus
  models: RuntimeModel[]
  supportsStreaming: boolean
  supportsTools: boolean
  supportsVision: boolean
  supportsEmbeddings: boolean
  supportsCode: boolean
  requiresApiKey: boolean
  privacyLevel: PrivacyLevel
}

export const SEED_PROVIDERS: ModelProvider[] = [
  {
    id: 'provider-ollama',
    name: 'Ollama',
    type: 'local',
    connectionStatus: 'mock',
    models: [
      {
        id: 'model-qwen',
        name: 'Qwen',
        providerId: 'provider-ollama',
        contextWindow: 32768,
        maxOutputTokens: 8192,
        costPer1kTokens: 0,
      },
      {
        id: 'model-deepseek',
        name: 'DeepSeek',
        providerId: 'provider-ollama',
        contextWindow: 65536,
        maxOutputTokens: 8192,
        costPer1kTokens: 0,
      },
      {
        id: 'model-llama',
        name: 'Llama',
        providerId: 'provider-ollama',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        costPer1kTokens: 0,
      },
    ],
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    supportsEmbeddings: true,
    supportsCode: true,
    requiresApiKey: false,
    privacyLevel: 'local-only',
  },
  {
    id: 'provider-openrouter',
    name: 'OpenRouter',
    type: 'hybrid',
    connectionStatus: 'mock',
    models: [
      {
        id: 'model-mimo',
        name: 'MiMo',
        providerId: 'provider-openrouter',
        contextWindow: 32768,
        maxOutputTokens: 8192,
        costPer1kTokens: 0.002,
      },
      {
        id: 'model-deepseek-or',
        name: 'DeepSeek',
        providerId: 'provider-openrouter',
        contextWindow: 65536,
        maxOutputTokens: 8192,
        costPer1kTokens: 0.0014,
      },
    ],
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    supportsEmbeddings: false,
    supportsCode: true,
    requiresApiKey: true,
    privacyLevel: 'hybrid',
  },
  {
    id: 'provider-openai',
    name: 'OpenAI',
    type: 'cloud',
    connectionStatus: 'mock',
    models: [
      {
        id: 'model-gpt',
        name: 'GPT',
        providerId: 'provider-openai',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        costPer1kTokens: 0.01,
      },
    ],
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    supportsEmbeddings: true,
    supportsCode: true,
    requiresApiKey: true,
    privacyLevel: 'cloud-ok',
  },
  {
    id: 'provider-anthropic',
    name: 'Anthropic',
    type: 'cloud',
    connectionStatus: 'mock',
    models: [
      {
        id: 'model-claude',
        name: 'Claude',
        providerId: 'provider-anthropic',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        costPer1kTokens: 0.015,
      },
    ],
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    supportsEmbeddings: false,
    supportsCode: true,
    requiresApiKey: true,
    privacyLevel: 'cloud-ok',
  },
  {
    id: 'provider-local-mock',
    name: 'Local Mock Provider',
    type: 'local',
    connectionStatus: 'mock',
    models: [
      {
        id: 'model-mock-local',
        name: 'Mock Local Model',
        providerId: 'provider-local-mock',
        contextWindow: 8192,
        maxOutputTokens: 2048,
        costPer1kTokens: 0,
      },
    ],
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    supportsEmbeddings: false,
    supportsCode: false,
    requiresApiKey: false,
    privacyLevel: 'local-only',
  },
]

export function getAllProviders(): ModelProvider[] {
  return SEED_PROVIDERS
}

export function getProviderById(id: string): ModelProvider | null {
  return SEED_PROVIDERS.find((item) => item.id === id) ?? null
}

export function getModelById(modelId: string): RuntimeModel | null {
  for (const provider of SEED_PROVIDERS) {
    const model = provider.models.find((item) => item.id === modelId)
    if (model) return model
  }
  return null
}

export function getProviderForModel(modelId: string): ModelProvider | null {
  const model = getModelById(modelId)
  if (!model) return null
  return getProviderById(model.providerId)
}

export function resolveModelIdFromLabel(label: string): string {
  const normalized = label.trim().toLowerCase()
  if (normalized.includes('qwen')) return 'model-qwen'
  if (normalized.includes('deepseek')) return 'model-deepseek'
  if (normalized.includes('llama')) return 'model-llama'
  if (normalized.includes('gpt')) return 'model-gpt'
  if (normalized.includes('claude')) return 'model-claude'
  if (normalized.includes('mimo')) return 'model-mimo'
  if (normalized.includes('mock')) return 'model-mock-local'
  return 'model-mock-local'
}
