import { useCallback, useMemo, useState } from 'react'
import {
  checkAllRuntimeProviderHealth,
  checkRuntimeProviderHealth,
  getActiveRuntimeProviderId,
  getRuntimeProvider,
  getRuntimeProviderStatus,
  initializeRuntimeProviders,
  listRuntimeProviders,
  setActiveRuntimeProviderId,
  type ProviderHealthResult,
  type ProviderStatusSnapshot,
  type RuntimeProviderId,
} from '../domain/runtime/providers/runtimeAdapter'

export function useRuntimeProvider() {
  initializeRuntimeProviders()

  const [activeProviderId, setActiveProviderIdState] = useState<RuntimeProviderId>(
    getActiveRuntimeProviderId,
  )
  const [healthByProvider, setHealthByProvider] = useState<
    Partial<Record<RuntimeProviderId, ProviderHealthResult>>
  >({})
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)

  const providers = useMemo(() => listRuntimeProviders(), [])
  const activeProvider = useMemo(
    () => getRuntimeProvider(activeProviderId),
    [activeProviderId],
  )
  const activeStatus = useMemo<ProviderStatusSnapshot>(
    () => getRuntimeProviderStatus(activeProviderId),
    [activeProviderId, lastCheckedAt],
  )
  const activeHealth = healthByProvider[activeProviderId] ?? activeStatus.lastHealth

  const refreshHealth = useCallback((providerId: RuntimeProviderId = activeProviderId) => {
    const health = checkRuntimeProviderHealth(providerId)
    setHealthByProvider((prev) => ({ ...prev, [providerId]: health }))
    setLastCheckedAt(health.checkedAt)
    return health
  }, [activeProviderId])

  const refreshAllHealth = useCallback(() => {
    const all = checkAllRuntimeProviderHealth()
    setHealthByProvider(all)
    const checkedAt = all[activeProviderId]?.checkedAt ?? new Date().toISOString()
    setLastCheckedAt(checkedAt)
    return all
  }, [activeProviderId])

  const setActiveProvider = useCallback((providerId: RuntimeProviderId) => {
    setActiveRuntimeProviderId(providerId)
    setActiveProviderIdState(providerId)
    const health = checkRuntimeProviderHealth(providerId)
    setHealthByProvider((prev) => ({ ...prev, [providerId]: health }))
    setLastCheckedAt(health.checkedAt)
  }, [])

  return {
    providers,
    activeProviderId,
    activeProvider,
    activeStatus,
    activeHealth,
    lastCheckedAt,
    healthByProvider,
    setActiveProvider,
    refreshHealth,
    refreshAllHealth,
  }
}

export type { RuntimeProviderId, ProviderHealthResult, ProviderStatusSnapshot }
