import { useState } from 'react'
import { OLLAMA_DEFAULT_BASE_URL, OLLAMA_MODEL_CATALOG } from '../../domain/runtime/providers/runtimeCapabilities'
import { useRuntimeProvider } from '../../hooks/useRuntimeProvider'
import { useI18n } from '../../i18n'

export function RuntimeHealth({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const {
    activeProviderId,
    activeProvider,
    activeHealth,
    activeStatus,
    loadedModels,
    ollamaSettings,
    checking,
    refreshAllHealth,
    saveOllamaSettings,
    setActiveProvider,
    providers,
    healthByProvider,
  } = useRuntimeProvider()

  const [baseUrl, setBaseUrl] = useState(ollamaSettings.baseUrl)
  const [defaultModelTag, setDefaultModelTag] = useState(ollamaSettings.defaultModelTag)

  const healthStatus = activeHealth?.status ?? 'unknown'

  return (
    <div className={compact ? 'mcRuntimeAdapterPanel mcRuntimeAdapterPanelCompact' : 'mcRuntimeAdapterPanel'}>
      <div className="mcRuntimeAdapterHead">
        <div>
          <h3 className="mcRuntimeAdapterTitle">{t.runtimeProviders.healthTitle}</h3>
          {!compact ? <p className="mcMuted mcRuntimeAdapterDescription">{t.runtimeProviders.healthDescription}</p> : null}
        </div>
        <button
          type="button"
          className="mcBtn mcBtnSecondary mcBtnSm"
          disabled={checking}
          onClick={() => void refreshAllHealth()}
        >
          {checking ? t.runtimeProviders.checkingHealth : t.runtimeProviders.refreshHealth}
        </button>
      </div>

      <div className="mcRuntimeAdapterMetrics">
        <div className="mcRuntimeAdapterMetric">
          <span className="mcRuntimeAdapterMetricLabel">{t.runtimeProviders.currentProvider}</span>
          <span className="mcRuntimeAdapterMetricValue">{activeProvider.name}</span>
        </div>
        <div className="mcRuntimeAdapterMetric">
          <span className="mcRuntimeAdapterMetricLabel">{t.runtimeProviders.providerStatus}</span>
          <span className={`mcRuntimeAdapterStatus mcRuntimeAdapterStatus${capitalize(healthStatus)}`}>
            {t.runtimeProviders.healthStatuses[healthStatus]}
          </span>
        </div>
        <div className="mcRuntimeAdapterMetric">
          <span className="mcRuntimeAdapterMetricLabel">{t.runtimeProviders.latency}</span>
          <span className="mcMono mcMuted">
            {activeHealth?.latencyMs != null ? `${activeHealth.latencyMs} ms` : t.common.empty}
          </span>
        </div>
        <div className="mcRuntimeAdapterMetric">
          <span className="mcRuntimeAdapterMetricLabel">{t.runtimeProviders.executionDuration}</span>
          <span className="mcMono mcMuted">
            {activeStatus.lastExecutionDurationMs != null
              ? `${activeStatus.lastExecutionDurationMs} ms`
              : t.common.empty}
          </span>
        </div>
        <div className="mcRuntimeAdapterMetric">
          <span className="mcRuntimeAdapterMetricLabel">{t.runtimeProviders.tokenEstimate}</span>
          <span className="mcMono mcMuted">
            {activeStatus.lastEstimatedTokens ?? t.common.empty}
          </span>
        </div>
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
            return (
              <button
                key={provider.id}
                type="button"
                className={`mcRuntimeAdapterProviderBtn${provider.id === activeProviderId ? ' mcRuntimeAdapterProviderBtnActive' : ''}`}
                onClick={() => void setActiveProvider(provider.id)}
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

      <div className="mcRuntimeOllamaSettings">
        <span className="mcFieldLabel">{t.runtimeProviders.ollamaSettings}</span>
        <label className="mcField">
          <span className="mcFieldLabel">{t.runtimeProviders.ollamaUrl}</span>
          <input
            className="mcInput"
            value={baseUrl}
            placeholder={OLLAMA_DEFAULT_BASE_URL}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
        <label className="mcField">
          <span className="mcFieldLabel">{t.runtimeProviders.defaultModel}</span>
          <select
            className="mcSelect"
            value={defaultModelTag}
            onChange={(event) => setDefaultModelTag(event.target.value)}
          >
            {OLLAMA_MODEL_CATALOG.map((item) => (
              <option key={item.tag} value={item.tag}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="mcBtn mcBtnSecondary mcBtnSm"
          onClick={() =>
            void saveOllamaSettings({
              ...ollamaSettings,
              baseUrl: baseUrl.trim() || ollamaSettings.baseUrl,
              defaultModelTag,
            })
          }
        >
          {t.runtimeProviders.saveSettings}
        </button>
      </div>

      <div className="mcRuntimeLoadedModels">
        <span className="mcFieldLabel">{t.runtimeProviders.loadedModels}</span>
        {loadedModels.length === 0 ? (
          <p className="mcMuted">{t.runtimeProviders.noLoadedModels}</p>
        ) : (
          <div className="mcRuntimeCapabilityRow">
            {loadedModels.map((model) => (
              <span key={model} className="mcRuntimeCapability">
                {model}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
