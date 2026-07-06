import { OLLAMA_LOCALHOST_ENDPOINT } from './ollamaSourceMode'

export const OLLAMA_DEFAULT_BASE_URL = OLLAMA_LOCALHOST_ENDPOINT

export const OLLAMA_DEFAULT_MODEL_TAG = 'qwen3.6:27b'

export const OLLAMA_EXECUTION_TIMEOUT_MS = 300_000

export const OLLAMA_FAST_TEST_MODEL_TAGS = ['qwen2.5-coder:7b', 'deepseek-r1:8b'] as const

export const OLLAMA_FAST_TEST_MAX_PROMPT_CHARS = 1_500

export const OLLAMA_LIGHTWEIGHT_CONTEXT_LAYER_KEYS = [
  'employee_profile',
  'runtime_profile',
] as const

export const OLLAMA_FAST_TEST_GENERATE_OPTIONS = {
  num_predict: 256,
  temperature: 0.2,
  top_k: 40,
  top_p: 0.9,
} as const

export const OLLAMA_DEFAULT_GENERATE_OPTIONS = {
  num_predict: 1024,
  temperature: 0.3,
} as const

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
  const aliasMap: Record<string, string> = {
    'model-qwen': 'model-qwen-36-27b',
    'model-deepseek': 'model-deepseek-r1',
  }
  const resolvedId = aliasMap[catalogModelId] ?? catalogModelId
  return TAG_BY_CATALOG_ID[resolvedId] ?? OLLAMA_DEFAULT_MODEL_TAG
}

export function resolveCatalogModelIdFromOllamaTag(tag: string): string {
  return CATALOG_BY_TAG[tag] ?? 'model-qwen-36-27b'
}

export function isOllamaCatalogModelId(modelId: string): boolean {
  return modelId in TAG_BY_CATALOG_ID
}

export function isOllamaFastTestModel(tag: string): boolean {
  return (OLLAMA_FAST_TEST_MODEL_TAGS as readonly string[]).includes(tag)
}

export function getOllamaGenerateOptions(modelTag: string): Record<string, number> {
  if (isOllamaFastTestModel(modelTag)) {
    return { ...OLLAMA_FAST_TEST_GENERATE_OPTIONS }
  }
  return { ...OLLAMA_DEFAULT_GENERATE_OPTIONS }
}

export function trimPromptForFastTest(prompt: string, modelTag: string): string {
  if (!isOllamaFastTestModel(modelTag)) return prompt
  if (prompt.length <= OLLAMA_FAST_TEST_MAX_PROMPT_CHARS) return prompt
  return `${prompt.slice(0, OLLAMA_FAST_TEST_MAX_PROMPT_CHARS)}\n\n[Prompt truncated for fast test mode]`
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
