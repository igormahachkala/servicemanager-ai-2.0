import { useEffect } from 'react'
import { useRuntimeProvider } from '../../hooks/useRuntimeProvider'
import { useI18n } from '../../i18n'
import type { RuntimeProviderId } from '../../domain/runtime/providers/runtimeAdapter'

export function RuntimeProviderHealthPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const {
    providers,
    activeProviderId,
    activeProvider,
    activeHealth,
    lastCheckedAt,
    healthByProvider,
    setActiveProvider,
    refreshAllHealth,
  } = useRuntimeProvider()

  useEffect(() => {
    void refreshAllHealth()
  }, [refreshAllHealth])

  const healthStatus = activeHealth?.status ?? 'unknown'

  return (
    <div className={compact ? 'mcRuntimeAdapterPanel mcRuntimeAdapterPanelCompact' : 'mcRuntimeAdapterPanel'}>
      <div className="mcRuntimeAdapterHead">
        <div>
          <h3 className="mcRuntimeAdapterTitle">{t.runtimeProviders.healthPanelTitle}</h3>
          {!compact ? (
            <p className="mcMuted mcRuntimeAdapterDescription">{t.runtimeProviders.healthPanelDescription}</p>
          ) : null}
        </div>
        <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" onClick={() => void refreshAllHealth()}>
          {t.runtimeProviders.refreshHealth}
        </button>
      </div>

      <div className="mcRuntimeAdapterMetrics">
        <div className="mcRuntimeAdapterMetric">
          <span className="mcRuntimeAdapterMetricLabel">{t.runtimeProviders.currentProvider}</span>
          <span className="mcRuntimeAdapterMetricValue">{activeProvider.name}</span>
          <span className="mcMono mcMuted">{activeProviderId}</span>
        </div>
        <div className="mcRuntimeAdapterMetric">
          <span className="mcRuntimeAdapterMetricLabel">{t.runtimeProviders.providerStatus}</span>
          <span className={`mcRuntimeAdapterStatus mcRuntimeAdapterStatus${capitalize(healthStatus)}`}>
            {t.runtimeProviders.healthStatuses[healthStatus]}
          </span>
        </div>
        <div className="mcRuntimeAdapterMetric">
          <span className="mcRuntimeAdapterMetricLabel">{t.runtimeProviders.lastCheck}</span>
          <span className="mcMono mcMuted">
            {lastCheckedAt ?? activeHealth?.checkedAt ?? t.common.empty}
          </span>
        </div>
      </div>

      <div className="mcRuntimeCapabilityRow">
        {activeProvider.capabilities.streaming ? (
          <span className="mcRuntimeCapability">{t.runtimeEngine.capabilities.streaming}</span>
        ) : null}
        {activeProvider.capabilities.tools ? (
          <span className="mcRuntimeCapability">{t.runtimeEngine.capabilities.tools}</span>
        ) : null}
        {activeProvider.capabilities.vision ? (
          <span className="mcRuntimeCapability">{t.runtimeEngine.capabilities.vision}</span>
        ) : null}
        {activeProvider.capabilities.code ? (
          <span className="mcRuntimeCapability">{t.runtimeEngine.capabilities.code}</span>
        ) : null}
        {activeProvider.capabilities.embeddings ? (
          <span className="mcRuntimeCapability">{t.runtimeProviders.capabilities.embeddings}</span>
        ) : null}
      </div>

      {activeHealth?.message ? (
        <p className="mcRuntimeAdapterHealthMessage mcMuted">{activeHealth.message}</p>
      ) : null}

      <div className="mcRuntimeAdapterProviderList">
        <span className="mcFieldLabel">{t.runtimeProviders.switchProvider}</span>
        <div className="mcRuntimeAdapterProviderButtons">
          {providers.map((provider) => {
            const health = healthByProvider[provider.id] ?? provider.status().lastHealth
            const status = health?.status ?? 'unknown'
            const selected = provider.id === activeProviderId
            return (
              <button
                key={provider.id}
                type="button"
                className={`mcRuntimeAdapterProviderBtn${selected ? ' mcRuntimeAdapterProviderBtnActive' : ''}`}
                onClick={() => void setActiveProvider(provider.id as RuntimeProviderId)}
              >
                <span>{provider.name}</span>
                <span className={`mcRuntimeAdapterStatus mcRuntimeAdapterStatus${capitalize(status)}`}>
                  {t.runtimeProviders.healthStatuses[status]}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
