import {
  DEFAULT_COST_POLICY,
  DEFAULT_PRIVACY_POLICY,
  modelPolicyFromProfile,
  type CostPolicy,
  type PrivacyPolicy,
} from './modelPolicy'
import {
  getAllProviders,
  getModelById,
  getProviderForModel,
  resolveModelIdFromLabel,
  type ModelProvider,
} from './modelProvider'
import {
  matchRoute,
  type ModelRoute,
  type ModelSelection,
  type TaskContext,
  type TaskType,
} from './modelRoute'
import {
  REASONING_LEVELS,
  RUNTIME_PROFILE_STATUSES,
  type ReasoningLevel,
  type RuntimeProfile,
  type RuntimeProfileStatus,
} from './runtimeProfile'

const STORAGE_KEY = 'ai-company-runtime-profiles'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parsePrivacyPolicy(value: unknown): PrivacyPolicy {
  if (!isRecord(value)) return { ...DEFAULT_PRIVACY_POLICY }
  return {
    localFirst: value.localFirst !== false,
    cloudAllowed: value.cloudAllowed !== false,
    sensitiveDataAllowed: value.sensitiveDataAllowed === true,
    requireApprovalForCloud: value.requireApprovalForCloud === true,
  }
}

function parseCostPolicy(value: unknown): CostPolicy {
  if (!isRecord(value)) return { ...DEFAULT_COST_POLICY }
  return {
    maxCostPerRun:
      typeof value.maxCostPerRun === 'number' ? value.maxCostPerRun : DEFAULT_COST_POLICY.maxCostPerRun,
    maxTokensPerRun:
      typeof value.maxTokensPerRun === 'number'
        ? value.maxTokensPerRun
        : DEFAULT_COST_POLICY.maxTokensPerRun,
  }
}

function parseRouteCondition(value: unknown): ModelRoute['conditions'][number] | null {
  if (!isRecord(value)) return null
  if (typeof value.key !== 'string' || typeof value.operator !== 'string') return null
  const operator = value.operator
  if (!['eq', 'neq', 'gt', 'lt'].includes(operator)) return null
  const raw = value.value
  if (
    typeof raw !== 'string' &&
    typeof raw !== 'number' &&
    typeof raw !== 'boolean'
  ) {
    return null
  }
  return {
    key: value.key,
    operator: operator as ModelRoute['conditions'][number]['operator'],
    value: raw,
  }
}

function parseModelRoute(value: unknown): ModelRoute | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null
  if (typeof value.taskType !== 'string' || typeof value.preferredModelId !== 'string') return null
  if (typeof value.priority !== 'number') return null
  const conditions = Array.isArray(value.conditions)
    ? value.conditions
        .map(parseRouteCondition)
        .filter((item): item is ModelRoute['conditions'][number] => item !== null)
    : []
  return {
    id: value.id,
    name: value.name,
    taskType: value.taskType as TaskType,
    preferredModelId: value.preferredModelId,
    fallbackModelIds: parseStringArray(value.fallbackModelIds),
    conditions,
    priority: value.priority,
  }
}

function parseRuntimeProfile(value: unknown): RuntimeProfile | null {
  if (!isRecord(value)) return null
  const status = parseProfileStatus(value.status)
  const reasoningLevel = parseReasoningLevel(value.reasoningLevel)
  if (
    !status ||
    !reasoningLevel ||
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.primaryModelId !== 'string' ||
    typeof value.temperature !== 'number' ||
    typeof value.contextWindow !== 'number' ||
    typeof value.maxTokens !== 'number' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  const routingRules = Array.isArray(value.routingRules)
    ? value.routingRules
        .map(parseModelRoute)
        .filter((item): item is ModelRoute => item !== null)
    : []

  return {
    id: value.id,
    employeeId: value.employeeId,
    primaryModelId: value.primaryModelId,
    fallbackModelIds: parseStringArray(value.fallbackModelIds),
    allowedProviderIds: parseStringArray(value.allowedProviderIds),
    routingRules,
    privacyPolicy: parsePrivacyPolicy(value.privacyPolicy),
    costPolicy: parseCostPolicy(value.costPolicy),
    reasoningLevel,
    temperature: value.temperature,
    contextWindow: value.contextWindow,
    maxTokens: value.maxTokens,
    status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function parseProfileStatus(value: unknown): RuntimeProfileStatus | null {
  return typeof value === 'string' &&
    (RUNTIME_PROFILE_STATUSES as readonly string[]).includes(value)
    ? (value as RuntimeProfileStatus)
    : null
}

function parseReasoningLevel(value: unknown): ReasoningLevel | null {
  return typeof value === 'string' && (REASONING_LEVELS as readonly string[]).includes(value)
    ? (value as ReasoningLevel)
    : null
}

export function loadRuntimeProfiles(): RuntimeProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseRuntimeProfile)
      .filter((item): item is RuntimeProfile => item !== null)
  } catch {
    return []
  }
}

export function saveRuntimeProfiles(profiles: RuntimeProfile[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  } catch {
    /* noop */
  }
}

export function getRuntimeProfileByEmployeeId(employeeId: string): RuntimeProfile | null {
  return loadRuntimeProfiles().find((item) => item.employeeId === employeeId) ?? null
}

export function upsertRuntimeProfile(profile: RuntimeProfile): RuntimeProfile {
  const next = loadRuntimeProfiles().filter((item) => item.employeeId !== profile.employeeId)
  saveRuntimeProfiles([profile, ...next])
  return profile
}

function isProviderAllowed(profile: RuntimeProfile, providerId: string): boolean {
  if (profile.allowedProviderIds.length === 0) return true
  return profile.allowedProviderIds.includes(providerId)
}

function isProviderHealthy(provider: ModelProvider): boolean {
  return provider.connectionStatus === 'connected' || provider.connectionStatus === 'mock'
}

function isCloudProvider(provider: ModelProvider): boolean {
  return provider.type === 'cloud' || provider.type === 'hybrid'
}

function estimateRunCost(modelId: string, estimatedTokens: number): number {
  const model = getModelById(modelId)
  if (!model || model.costPer1kTokens === null) return 0
  return (estimatedTokens / 1000) * model.costPer1kTokens
}

function modelMeetsRequirements(modelId: string, context: TaskContext): boolean {
  const provider = getProviderForModel(modelId)
  if (!provider) return false
  if (context.requiresVision && !provider.supportsVision) return false
  if (context.requiresTools && !provider.supportsTools) return false
  if (context.requiresCode && !provider.supportsCode) return false
  return true
}

function buildCandidateChain(
  profile: RuntimeProfile,
  preferredIds: string[],
  context: TaskContext,
): string[] {
  const policy = modelPolicyFromProfile(profile.privacyPolicy, profile.costPolicy)
  const seen = new Set<string>()
  const candidates: string[] = []

  const push = (modelId: string) => {
    if (seen.has(modelId)) return
    seen.add(modelId)
    candidates.push(modelId)
  }

  for (const modelId of preferredIds) push(modelId)
  push(profile.primaryModelId)
  for (const modelId of profile.fallbackModelIds) push(modelId)

  return candidates.filter((modelId) => {
    const provider = getProviderForModel(modelId)
    const model = getModelById(modelId)
    if (!provider || !model) return false
    if (!isProviderAllowed(profile, provider.id)) return false
    if (!isProviderHealthy(provider)) return false
    if (!modelMeetsRequirements(modelId, context)) return false

    if (context.hasSensitiveData && !policy.sensitiveDataAllowed && isCloudProvider(provider)) {
      return false
    }
    if (!policy.cloudAllowed && isCloudProvider(provider)) return false
    if (policy.localFirst || context.preferLocal) {
      if (isCloudProvider(provider) && !policy.cloudAllowed) return false
    }

    const tokens = context.estimatedTokens ?? profile.maxTokens
    if (tokens > model.maxOutputTokens && tokens > profile.maxTokens) return false

    const cost = estimateRunCost(modelId, tokens)
    if (cost > policy.maxCostPerRun) return false

    return true
  })
}

function pickBestCandidate(
  profile: RuntimeProfile,
  candidates: string[],
  context: TaskContext,
): { modelId: string; reason: string } | null {
  const policy = modelPolicyFromProfile(profile.privacyPolicy, profile.costPolicy)

  if (candidates.length === 0) return null

  const sorted = [...candidates].sort((a, b) => {
    const providerA = getProviderForModel(a)
    const providerB = getProviderForModel(b)
    if (!providerA || !providerB) return 0
    if (policy.localFirst || context.preferLocal) {
      if (providerA.type === 'local' && providerB.type !== 'local') return -1
      if (providerB.type === 'local' && providerA.type !== 'local') return 1
    }
    const costA = estimateRunCost(a, context.estimatedTokens ?? profile.maxTokens)
    const costB = estimateRunCost(b, context.estimatedTokens ?? profile.maxTokens)
    return costA - costB
  })

  const selected = sorted[0]
  const provider = getProviderForModel(selected)
  if (!provider) return null

  let reason = 'Default profile primary/fallback chain'
  if (context.hasSensitiveData && !policy.sensitiveDataAllowed) {
    reason = 'Sensitive data — local-first routing applied'
  } else if (policy.localFirst) {
    reason = 'Local-first policy — preferring on-prem models'
  } else if (context.taskType !== 'general') {
    reason = `Task type "${context.taskType}" routing`
  }

  return { modelId: selected, reason }
}

export function selectModelForTask(
  profile: RuntimeProfile,
  taskContext: TaskContext,
): ModelSelection | null {
  const policy = modelPolicyFromProfile(profile.privacyPolicy, profile.costPolicy)
  const matchedRoutes = profile.routingRules
    .filter((route) => matchRoute(route, taskContext))
    .sort((a, b) => b.priority - a.priority)

  const preferredIds =
    matchedRoutes.length > 0
      ? [matchedRoutes[0].preferredModelId, ...matchedRoutes[0].fallbackModelIds]
      : [profile.primaryModelId, ...profile.fallbackModelIds]

  const candidates = buildCandidateChain(profile, preferredIds, taskContext)
  const picked = pickBestCandidate(profile, candidates, taskContext)
  if (!picked) return null

  const selectedProvider = getProviderForModel(picked.modelId)
  if (!selectedProvider) return null

  const fallbackChain = candidates
    .filter((modelId) => modelId !== picked.modelId)
    .map((modelId) => {
      const provider = getProviderForModel(modelId)
      return provider ? { modelId, providerId: provider.id } : null
    })
    .filter((item): item is { modelId: string; providerId: string } => item !== null)

  let requiresApproval = false
  if (policy.requireApprovalForCloud && isCloudProvider(selectedProvider)) {
    requiresApproval = true
  }
  if (policy.requireApprovalForExternalTools && taskContext.requiresExternalTools) {
    requiresApproval = true
  }
  if (profile.privacyPolicy.requireApprovalForCloud && isCloudProvider(selectedProvider)) {
    requiresApproval = true
  }

  return {
    selectedModelId: picked.modelId,
    selectedProviderId: selectedProvider.id,
    reason: picked.reason,
    fallbackChain: policy.fallbackOnFailure ? fallbackChain : [],
    requiresApproval,
  }
}

function defaultRoutes(primaryModelId: string, fallbackModelIds: string[]): ModelRoute[] {
  return [
    {
      id: 'route-coding',
      name: 'Coding tasks',
      taskType: 'coding',
      preferredModelId: fallbackModelIds[0] ?? primaryModelId,
      fallbackModelIds: [primaryModelId, ...fallbackModelIds],
      conditions: [{ key: 'requiresCode', operator: 'eq', value: true }],
      priority: 20,
    },
    {
      id: 'route-conversation',
      name: 'Conversation',
      taskType: 'conversation',
      preferredModelId: primaryModelId,
      fallbackModelIds,
      conditions: [],
      priority: 10,
    },
    {
      id: 'route-analysis',
      name: 'Deep analysis',
      taskType: 'analysis',
      preferredModelId: primaryModelId,
      fallbackModelIds,
      conditions: [],
      priority: 15,
    },
  ]
}

function createSeedProfile(
  employeeId: string,
  primaryModelLabel: string,
  fallbackLabels: string[],
  overrides: Partial<RuntimeProfile> = {},
): RuntimeProfile {
  const now = new Date().toISOString()
  const primaryModelId = resolveModelIdFromLabel(primaryModelLabel)
  const fallbackModelIds = fallbackLabels.map(resolveModelIdFromLabel)
  const allowedProviderIds = getAllProviders().map((item) => item.id)

  return {
    id: `runtime-${employeeId}`,
    employeeId,
    primaryModelId,
    fallbackModelIds,
    allowedProviderIds,
    routingRules: defaultRoutes(primaryModelId, fallbackModelIds),
    privacyPolicy: { ...DEFAULT_PRIVACY_POLICY },
    costPolicy: { ...DEFAULT_COST_POLICY },
    reasoningLevel: 'standard',
    temperature: 0.4,
    contextWindow: getModelById(primaryModelId)?.contextWindow ?? 32768,
    maxTokens: 4096,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function ensureSeedRuntimeProfiles(): void {
  if (loadRuntimeProfiles().length > 0) return

  const seeds: RuntimeProfile[] = [
    createSeedProfile('ag-cto', 'Qwen 3.6', ['Qwen Coder', 'DeepSeek R1'], {
      primaryModelId: 'model-qwen-36-27b',
      fallbackModelIds: ['model-qwen-coder', 'model-deepseek-r1'],
      allowedProviderIds: ['provider-ollama', 'provider-local-mock', 'provider-openai', 'provider-anthropic'],
      privacyPolicy: {
        localFirst: true,
        cloudAllowed: true,
        sensitiveDataAllowed: false,
        requireApprovalForCloud: false,
      },
      reasoningLevel: 'deep',
      temperature: 0.3,
    }),
    createSeedProfile('ag-max', 'Claude Code', ['DeepSeek', 'GPT'], {
      routingRules: defaultRoutes('model-claude', ['model-deepseek', 'model-gpt']),
      reasoningLevel: 'standard',
      temperature: 0.2,
    }),
    createSeedProfile('ag-qa', 'GPT', ['Llama', 'Mock Local Model'], {
      primaryModelId: 'model-gpt',
      fallbackModelIds: ['model-llama', 'model-mock-local'],
      privacyPolicy: {
        localFirst: true,
        cloudAllowed: true,
        sensitiveDataAllowed: false,
        requireApprovalForCloud: false,
      },
    }),
    createSeedProfile('ag-arch', 'DeepSeek', ['Claude', 'Qwen'], {
      reasoningLevel: 'deep',
    }),
  ]

  saveRuntimeProfiles(seeds)
}

export function getOrCreateRuntimeProfile(
  employeeId: string,
  primaryModelLabel?: string,
): RuntimeProfile {
  ensureSeedRuntimeProfiles()
  const existing = getRuntimeProfileByEmployeeId(employeeId)
  if (existing) return existing

  const created = createSeedProfile(
    employeeId,
    primaryModelLabel ?? 'Mock Local Model',
    ['Qwen', 'Mock Local Model'],
  )
  upsertRuntimeProfile(created)
  return created
}

export type {
  CostPolicy,
  ModelPolicy,
  PrivacyPolicy,
} from './modelPolicy'
export type {
  ModelProvider,
  ProviderType,
  RuntimeModel,
  ConnectionStatus,
} from './modelProvider'
export type {
  ModelRoute,
  ModelSelection,
  RouteCondition,
  TaskContext,
  TaskType,
} from './modelRoute'
export type {
  ReasoningLevel,
  RuntimeProfile,
  RuntimeProfileStatus,
} from './runtimeProfile'
export {
  DEFAULT_COST_POLICY,
  DEFAULT_MODEL_POLICY,
  DEFAULT_PRIVACY_POLICY,
} from './modelPolicy'
export {
  getAllProviders,
  getModelById,
  getProviderById,
  getProviderForModel,
  resolveModelIdFromLabel,
  SEED_PROVIDERS,
} from './modelProvider'
export { TASK_TYPES } from './modelRoute'
export { REASONING_LEVELS, RUNTIME_PROFILE_STATUSES } from './runtimeProfile'
