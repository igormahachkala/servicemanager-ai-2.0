import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkAllRuntimeProviderHealth,
  checkRuntimeProviderHealth,
  getActiveRuntimeProviderId,
  getOllamaSettings,
  getRuntimeProvider,
  getRuntimeProviderStatus,
  initializeRuntimeProviders,
  listRuntimeProviderModels,
  listRuntimeProviders,
  setActiveRuntimeProviderId,
  updateOllamaSettings,
  type OllamaSettings,
  type ProviderHealthResult,
  type ProviderStatusSnapshot,
  type RuntimeProviderId,
} from '../domain/runtime/providers/runtimeAdapter'

export function useRuntimeProvider() {
  initializeRuntimeProviders()

  const [activeProviderId, setActiveProviderIdState] = useState<RuntimeProviderId>(() =>
    getActiveRuntimeProviderId(),
  )
  const [healthByProvider, setHealthByProvider] = useState<
    Partial<Record<RuntimeProviderId, ProviderHealthResult>>
  >({})
  const [loadedModels, setLoadedModels] = useState<string[]>([])
  const [ollamaSettings, setOllamaSettingsState] = useState<OllamaSettings>(() => getOllamaSettings())
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const providers = useMemo(() => listRuntimeProviders(), [])
  const activeProvider = useMemo(
    () => getRuntimeProvider(activeProviderId),
    [activeProviderId],
  )
  const activeStatus = useMemo<ProviderStatusSnapshot>(
    () => getRuntimeProvider(activeProviderId).status(),
    [activeProviderId, lastCheckedAt],
  )
  const activeHealth = healthByProvider[activeProviderId] ?? activeStatus.lastHealth

  const refreshHealth = useCallback(async (providerId: RuntimeProviderId = activeProviderId) => {
    setChecking(true)
    try {
      const health = await checkRuntimeProviderHealth(providerId)
      setHealthByProvider((prev) => ({ ...prev, [providerId]: health }))
      setLastCheckedAt(health.checkedAt)
      if (providerId === 'ollama') {
        setLoadedModels(health.loadedModels ?? [])
      }
      await getRuntimeProviderStatus(providerId)
      return health
    } finally {
      setChecking(false)
    }
  }, [activeProviderId])

  const refreshAllHealth = useCallback(async () => {
    setChecking(true)
    try {
      const all = await checkAllRuntimeProviderHealth()
      setHealthByProvider(all)
      const checkedAt = all[activeProviderId]?.checkedAt ?? new Date().toISOString()
      setLastCheckedAt(checkedAt)
      setLoadedModels(all.ollama?.loadedModels ?? [])
      return all
    } finally {
      setChecking(false)
    }
  }, [activeProviderId])

  const refreshModels = useCallback(async () => {
    const models = await listRuntimeProviderModels(activeProviderId)
    setLoadedModels(models)
    return models
  }, [activeProviderId])

  const setActiveProvider = useCallback(async (providerId: RuntimeProviderId) => {
    setActiveRuntimeProviderId(providerId)
    setActiveProviderIdState(providerId)
    await refreshHealth(providerId)
  }, [refreshHealth])

  const saveOllamaSettings = useCallback(
    async (settings: OllamaSettings) => {
      const saved = updateOllamaSettings(settings)
      setOllamaSettingsState(saved)
      if (activeProviderId === 'ollama') {
        await refreshHealth('ollama')
      }
      return saved
    },
    [activeProviderId, refreshHealth],
  )

  useEffect(() => {
    void refreshAllHealth()
  }, [refreshAllHealth])

  return {
    providers,
    activeProviderId,
    activeProvider,
    activeStatus,
    activeHealth,
    lastCheckedAt,
    healthByProvider,
    loadedModels,
    ollamaSettings,
    checking,
    setActiveProvider,
    refreshHealth,
    refreshAllHealth,
    refreshModels,
    saveOllamaSettings,
  }
}

export type { RuntimeProviderId, ProviderHealthResult, ProviderStatusSnapshot, OllamaSettings }
