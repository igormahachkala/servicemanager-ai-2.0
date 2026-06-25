import type {
  ProviderHealthResult,
  ProviderStatusSnapshot,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeProviderId,
} from './runtimeProvider'
import { isRuntimeProviderId } from './providerRegistry'
import {
  getRuntimeProvider,
  listRuntimeProviders,
} from './providerRegistry'

const ACTIVE_PROVIDER_KEY = 'ai-company-runtime-active-provider'
const DEFAULT_PROVIDER_ID: RuntimeProviderId = 'mock'

let engineInitialized = false

function readActiveProviderId(): RuntimeProviderId {
  if (typeof localStorage === 'undefined') return DEFAULT_PROVIDER_ID
  const stored = localStorage.getItem(ACTIVE_PROVIDER_KEY)
  if (stored && isRuntimeProviderId(stored)) return stored
  return DEFAULT_PROVIDER_ID
}

function writeActiveProviderId(providerId: RuntimeProviderId): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ACTIVE_PROVIDER_KEY, providerId)
}

export function initializeRuntimeProviders(): void {
  if (engineInitialized) return
  for (const provider of listRuntimeProviders()) {
    provider.initialize()
  }
  engineInitialized = true
}

export function getActiveRuntimeProviderId(): RuntimeProviderId {
  initializeRuntimeProviders()
  return readActiveProviderId()
}

export function setActiveRuntimeProviderId(providerId: RuntimeProviderId): RuntimeProviderId {
  initializeRuntimeProviders()
  writeActiveProviderId(providerId)
  return providerId
}

export function getRuntimeProviderStatus(
  providerId: RuntimeProviderId = getActiveRuntimeProviderId(),
): ProviderStatusSnapshot {
  initializeRuntimeProviders()
  return getRuntimeProvider(providerId).status()
}

export function checkRuntimeProviderHealth(
  providerId: RuntimeProviderId = getActiveRuntimeProviderId(),
): ProviderHealthResult {
  initializeRuntimeProviders()
  const provider = getRuntimeProvider(providerId)
  const health = provider.health()
  if (health instanceof Promise) {
    throw new Error('Async provider health is not supported in V1 adapter.')
  }
  return health
}

export function checkAllRuntimeProviderHealth(): Record<RuntimeProviderId, ProviderHealthResult> {
  initializeRuntimeProviders()
  const results = {} as Record<RuntimeProviderId, ProviderHealthResult>
  for (const provider of listRuntimeProviders()) {
    const health = provider.health()
    if (health instanceof Promise) {
      throw new Error('Async provider health is not supported in V1 adapter.')
    }
    results[provider.id] = health
  }
  return results
}

export function executeViaRuntimeAdapter(
  request: RuntimeExecutionRequest,
): RuntimeExecutionResult {
  initializeRuntimeProviders()
  const providerId = getActiveRuntimeProviderId()
  const provider = getRuntimeProvider(providerId)
  const execution = provider.execute(request)
  if (execution instanceof Promise) {
    throw new Error('Async provider execution is not supported in V1 adapter.')
  }
  return execution
}

export function cancelRuntimeExecution(runId: string): boolean {
  initializeRuntimeProviders()
  const provider = getRuntimeProvider(getActiveRuntimeProviderId())
  const cancelled = provider.cancel(runId)
  if (cancelled instanceof Promise) {
    throw new Error('Async provider cancel is not supported in V1 adapter.')
  }
  return cancelled
}

export {
  listRuntimeProviders,
  getRuntimeProvider,
  isRuntimeProviderId,
} from './providerRegistry'

export type {
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeProvider,
  RuntimeProviderId,
  ProviderCapabilities,
  ProviderHealthResult,
  ProviderHealthStatus,
  ProviderStatusSnapshot,
} from './runtimeProvider'
