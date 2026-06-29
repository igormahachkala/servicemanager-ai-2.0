import { getActiveRuntimeProviderId } from './providers/runtimeAdapter'
import {
  isOllamaFastTestModel,
  OLLAMA_EXECUTION_TIMEOUT_MS,
  OLLAMA_MODEL_CATALOG,
  resolveOllamaModelTag,
} from './providers/runtimeCapabilities'
import { getModelById, getProviderById } from './modelProvider'
import type { RuntimeProfile } from './runtimeProfile'

export const RUNTIME_MODEL_MODES = ['fast', 'deep', 'coding', 'qa'] as const

export type RuntimeModelMode = (typeof RUNTIME_MODEL_MODES)[number]

export type RuntimeModelSpeed = 'fast' | 'medium' | 'slow'

export type RuntimeModelRoute = {
  employeeId: string
  runtimeProfileId: string
  runtimeProfileLabel: string
  modelMode: RuntimeModelMode
  providerId: string
  providerName: string
  executionProviderId: string
  catalogModelId: string
  catalogModelLabel: string
  resolvedOllamaTag: string
  estimatedSpeed: RuntimeModelSpeed
  estimatedContext: number
  expectedTimeoutMs: number
  fastTestMode: boolean
  routingReason: string
}

const MODE_SPECS: Record<
  RuntimeModelMode,
  {
    catalogModelId: string
    estimatedSpeed: RuntimeModelSpeed
    estimatedContext: number
  }
> = {
  fast: {
    catalogModelId: 'model-deepseek-r1',
    estimatedSpeed: 'fast',
    estimatedContext: 65536,
  },
  deep: {
    catalogModelId: 'model-qwen-36-27b',
    estimatedSpeed: 'slow',
    estimatedContext: 32768,
  },
  coding: {
    catalogModelId: 'model-qwen-coder',
    estimatedSpeed: 'fast',
    estimatedContext: 32768,
  },
  qa: {
    catalogModelId: 'model-deepseek-r1',
    estimatedSpeed: 'fast',
    estimatedContext: 65536,
  },
}

const EMPLOYEE_LOCKED_MODE: Partial<Record<string, RuntimeModelMode>> = {
  'ag-max': 'coding',
  'ag-qa': 'qa',
}

const EMPLOYEE_DEFAULT_MODE: Partial<Record<string, RuntimeModelMode>> = {
  'ag-cto': 'fast',
  'ag-max': 'coding',
  'ag-qa': 'qa',
}

function catalogLabel(catalogModelId: string): string {
  const match = OLLAMA_MODEL_CATALOG.find((item) => item.id === catalogModelId)
  if (match) return match.label
  return getModelById(catalogModelId)?.name ?? catalogModelId
}

export function resolveRuntimeModelMode(
  employeeId: string,
  requested?: RuntimeModelMode | null,
): RuntimeModelMode {
  const locked = EMPLOYEE_LOCKED_MODE[employeeId]
  if (locked) return locked
  if (employeeId === 'ag-cto') {
    return requested === 'deep' ? 'deep' : 'fast'
  }
  return requested ?? EMPLOYEE_DEFAULT_MODE[employeeId] ?? 'fast'
}

export function listRuntimeModelModesForEmployee(employeeId: string): RuntimeModelMode[] {
  if (employeeId === 'ag-max') return ['coding']
  if (employeeId === 'ag-qa') return ['qa']
  if (employeeId === 'ag-cto') return ['fast', 'deep']
  return [...RUNTIME_MODEL_MODES]
}

export function suggestRuntimeModelMode(employeeId: string): RuntimeModelMode {
  return resolveRuntimeModelMode(employeeId)
}

export function resolveRuntimeModelRoute(input: {
  employeeId: string
  profile: RuntimeProfile
  modelMode?: RuntimeModelMode | null
  ollamaModelTagOverride?: string | null
}): RuntimeModelRoute {
  const modelMode = resolveRuntimeModelMode(input.employeeId, input.modelMode)
  const spec = MODE_SPECS[modelMode]
  const catalogModelId = spec.catalogModelId
  const resolvedOllamaTag =
    input.ollamaModelTagOverride?.trim() ||
    resolveOllamaModelTag(catalogModelId)
  const providerId = 'provider-ollama'
  const provider = getProviderById(providerId)
  const executionProviderId = getActiveRuntimeProviderId()

  return {
    employeeId: input.employeeId,
    runtimeProfileId: input.profile.id,
    runtimeProfileLabel: input.profile.id.replace(/^runtime-/, ''),
    modelMode,
    providerId,
    providerName: provider?.name ?? 'Ollama',
    executionProviderId,
    catalogModelId,
    catalogModelLabel: catalogLabel(catalogModelId),
    resolvedOllamaTag,
    estimatedSpeed: spec.estimatedSpeed,
    estimatedContext: spec.estimatedContext,
    expectedTimeoutMs: OLLAMA_EXECUTION_TIMEOUT_MS,
    fastTestMode: isOllamaFastTestModel(resolvedOllamaTag),
    routingReason: `${input.employeeId} · ${modelMode} → ${resolvedOllamaTag}`,
  }
}

export function formatRuntimeModelSpeed(speed: RuntimeModelSpeed): string {
  switch (speed) {
    case 'fast':
      return '~fast'
    case 'medium':
      return '~medium'
    case 'slow':
      return '~slow'
    default:
      return speed
  }
}
