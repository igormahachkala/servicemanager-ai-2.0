export const OLLAMA_DEFAULT_BASE_URL = 'http://194.67.92.12:11434'

export const OLLAMA_DEFAULT_MODEL_TAG = 'qwen3.6:27b'

export const OLLAMA_MODEL_CATALOG = [
  {
    id: 'model-qwen-36-27b',
    tag: 'qwen3.6:27b',
    label: 'Qwen 3.6 27B',
  },
  {
    id: 'model-qwen-coder',
    tag: 'qwen2.5-coder:7b',
    label: 'Qwen 2.5 Coder 7B',
  },
  {
    id: 'model-qwen-vl',
    tag: 'qwen2.5vl:7b',
    label: 'Qwen 2.5 VL 7B',
  },
  {
    id: 'model-deepseek-r1',
    tag: 'deepseek-r1:8b',
    label: 'DeepSeek R1 8B',
  },
] as const

export type OllamaCatalogModelId = (typeof OLLAMA_MODEL_CATALOG)[number]['id']

const TAG_BY_CATALOG_ID = Object.fromEntries(
  OLLAMA_MODEL_CATALOG.map((item) => [item.id, item.tag]),
) as Record<string, string>

const CATALOG_BY_TAG = Object.fromEntries(
  OLLAMA_MODEL_CATALOG.map((item) => [item.tag, item.id]),
) as Record<string, string>

export function resolveOllamaModelTag(catalogModelId: string): string {
  return TAG_BY_CATALOG_ID[catalogModelId] ?? OLLAMA_DEFAULT_MODEL_TAG
}

export function resolveCatalogModelIdFromOllamaTag(tag: string): string {
  return CATALOG_BY_TAG[tag] ?? 'model-qwen-36-27b'
}

export function isOllamaCatalogModelId(modelId: string): boolean {
  return modelId in TAG_BY_CATALOG_ID
}

export const OLLAMA_PROVIDER_CAPABILITIES = {
  streaming: true,
  tools: false,
  vision: true,
  code: true,
  embeddings: true,
} as const

export const MOCK_PROVIDER_CAPABILITIES = {
  streaming: true,
  tools: false,
  vision: false,
  code: false,
  embeddings: false,
} as const
