import { useEffect, useMemo, useState } from 'react'
import {
  inferDeployEnvironmentFromHost,
  OLLAMA_LOCALHOST_ENDPOINT,
  resolveOllamaBaseUrl,
  type OllamaEndpointMode,
} from '../../domain/runtime/providers/ollamaSourceMode'
import { OLLAMA_MODEL_CATALOG } from '../../domain/runtime/providers/runtimeCapabilities'
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

  const detectedDeploy = inferDeployEnvironmentFromHost()

  const [endpointMode, setEndpointMode] = useState<OllamaEndpointMode>(ollamaSettings.endpointMode)
  const [customBaseUrl, setCustomBaseUrl] = useState(
    ollamaSettings.endpointMode === 'custom' ? ollamaSettings.baseUrl : '',
  )
  const [defaultModelTag, setDefaultModelTag] = useState(ollamaSettings.defaultModelTag)

  useEffect(() => {
    setEndpointMode(ollamaSettings.endpointMode)
    setCustomBaseUrl(ollamaSettings.endpointMode === 'custom' ? ollamaSettings.baseUrl : '')
    setDefaultModelTag(ollamaSettings.defaultModelTag)
  }, [ollamaSettings])

  const resolvedBaseUrl = useMemo(
    () =>
      resolveOllamaBaseUrl({
        endpointMode,
        baseUrl: customBaseUrl || ollamaSettings.baseUrl,
      }),
    [endpointMode, customBaseUrl, ollamaSettings.baseUrl],
  )

  const healthStatus = activeHealth?.status ?? 'unknown'
  const sourceGuide = t.runtimeProviders.ollamaSourceGuide

  const handleSaveSettings = () => {
    void saveOllamaSettings({
      deployEnvironment: detectedDeploy,
      endpointMode,
      baseUrl: endpointMode === 'custom' ? customBaseUrl : resolvedBaseUrl,
      defaultModelTag,
    })
  }

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

        <div className="mcRuntimeOllamaSourceGuide">
          <h4 className="mcRuntimeOllamaSourceGuideTitle">{sourceGuide.title}</h4>
          <p className="mcMuted">{sourceGuide.what}</p>
          <p className="mcMuted">{sourceGuide.whyLocalhostInProd}</p>
          <ul className="mcRuntimeOllamaSourceGuideList">
            <li>{sourceGuide.devMacRole}</li>
            <li>{sourceGuide.prodServerRole}</li>
            <li>{sourceGuide.whenCustom}</li>
            <li>{sourceGuide.securityNote}</li>
          </ul>
        </div>

        <p className="mcMuted">
          {t.runtimeProviders.ollamaDeployDetected.replace(
            '{env}',
            t.runtimeProviders.ollamaDeployEnvironments[detectedDeploy].label,
          )}
        </p>

        <fieldset className="mcRuntimeOllamaSourceModes">
          <legend className="mcFieldLabel">{t.runtimeProviders.ollamaEndpointMode}</legend>
          {(['localhost', 'custom'] as const).map((mode) => (
            <label key={mode} className="mcRuntimeOllamaSourceModeOption">
              <input
                type="radio"
                name="ollama-endpoint-mode"
                value={mode}
                checked={endpointMode === mode}
                onChange={() => setEndpointMode(mode)}
              />
              <span>
                <strong>{t.runtimeProviders.ollamaEndpointModes[mode].label}</strong>
                <span className="mcMuted mcRuntimeOllamaSourceModeHint">
                  {t.runtimeProviders.ollamaEndpointModes[mode].hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {endpointMode === 'localhost' ? (
          <label className="mcField">
            <span className="mcFieldLabel">{t.runtimeProviders.ollamaUrl}</span>
            <input className="mcInput mcMono" value={OLLAMA_LOCALHOST_ENDPOINT} readOnly />
            <span className="mcMuted">{t.runtimeProviders.ollamaLocalhostNote}</span>
          </label>
        ) : null}

        {endpointMode === 'custom' ? (
          <>
            <label className="mcField">
              <span className="mcFieldLabel">{t.runtimeProviders.ollamaCustomUrl}</span>
              <input
                className="mcInput mcMono"
                value={customBaseUrl}
                placeholder={t.runtimeProviders.ollamaCustomUrlPlaceholder}
                onChange={(event) => setCustomBaseUrl(event.target.value)}
              />
            </label>
            <p className="mcRuntimeOllamaVpsWarning mcMuted">{t.runtimeProviders.ollamaCustomWarning}</p>
          </>
        ) : null}

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

        <div className="mcRuntimeOllamaResolvedUrl">
          <span className="mcFieldLabel">{t.runtimeProviders.ollamaResolvedUrl}</span>
          <span className="mcMono">{resolvedBaseUrl}</span>
        </div>

        <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" onClick={handleSaveSettings}>
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
