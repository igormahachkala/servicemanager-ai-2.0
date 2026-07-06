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
import {
  loadOllamaSettings,
  saveOllamaSettings,
  type OllamaSettings,
} from './runtimeHealth'
import { getDefaultRuntimeProviderFromEnv } from '../../../config/environment'

const ACTIVE_PROVIDER_KEY = 'ai-company-runtime-active-provider'
const DEFAULT_PROVIDER_ID: RuntimeProviderId = getDefaultRuntimeProviderFromEnv()

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
  if (typeof localStorage !== 'undefined' && !localStorage.getItem(ACTIVE_PROVIDER_KEY)) {
    writeActiveProviderId(DEFAULT_PROVIDER_ID)
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

export function getOllamaSettings(): OllamaSettings {
  return loadOllamaSettings()
}

export function updateOllamaSettings(settings: OllamaSettings): OllamaSettings {
  saveOllamaSettings(settings)
  return loadOllamaSettings()
}

export async function getRuntimeProviderStatus(
  providerId: RuntimeProviderId = getActiveRuntimeProviderId(),
): Promise<ProviderStatusSnapshot> {
  initializeRuntimeProviders()
  return getRuntimeProvider(providerId).status()
}

export async function checkRuntimeProviderHealth(
  providerId: RuntimeProviderId = getActiveRuntimeProviderId(),
): Promise<ProviderHealthResult> {
  initializeRuntimeProviders()
  const provider = getRuntimeProvider(providerId)
  return Promise.resolve(provider.health())
}

export async function checkAllRuntimeProviderHealth(): Promise<
  Record<RuntimeProviderId, ProviderHealthResult>
> {
  initializeRuntimeProviders()
  const results = {} as Record<RuntimeProviderId, ProviderHealthResult>
  for (const provider of listRuntimeProviders()) {
    results[provider.id] = await Promise.resolve(provider.health())
  }
  return results
}

export async function listRuntimeProviderModels(
  providerId: RuntimeProviderId = getActiveRuntimeProviderId(),
): Promise<string[]> {
  initializeRuntimeProviders()
  const provider = getRuntimeProvider(providerId)
  if (!provider.listModels) return []
  return Promise.resolve(provider.listModels())
}

export async function executeViaRuntimeAdapter(
  request: RuntimeExecutionRequest,
): Promise<RuntimeExecutionResult> {
  initializeRuntimeProviders()
  const providerId = getActiveRuntimeProviderId()
  const provider = getRuntimeProvider(providerId)
  return Promise.resolve(provider.execute(request))
}

export async function cancelRuntimeExecution(runId: string): Promise<boolean> {
  initializeRuntimeProviders()
  const provider = getRuntimeProvider(getActiveRuntimeProviderId())
  return Promise.resolve(provider.cancel(runId))
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

export type { OllamaSettings } from './runtimeHealth'
