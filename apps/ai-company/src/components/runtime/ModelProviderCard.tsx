import type { ModelProvider } from '../../domain/runtime/runtimeStorage'
import { useI18n } from '../../i18n'

export function ModelProviderCard({ provider }: { provider: ModelProvider }) {
  const { t } = useI18n()

  return (
    <article className="mcRuntimeProviderCard">
      <div className="mcRuntimeProviderHead">
        <div>
          <h3 className="mcRuntimeProviderTitle">{provider.name}</h3>
          <div className="mcRuntimeProviderMeta mcMono mcMuted">{provider.id}</div>
        </div>
        <span className={`mcRuntimeProviderType mcRuntimeProviderType${capitalize(provider.type)}`}>
          {t.runtimeEngine.providerTypes[provider.type]}
        </span>
      </div>

      <div className="mcRuntimeProviderBody">
        <div className="mcRuntimeProviderRow">
          <span>{t.runtimeEngine.connectionStatus}</span>
          <span className="mcMono">
            {t.runtimeEngine.connectionStatuses[provider.connectionStatus]}
          </span>
        </div>
        <div className="mcRuntimeProviderRow">
          <span>{t.runtimeEngine.privacyLevel}</span>
          <span>{t.runtimeEngine.privacyLevels[provider.privacyLevel]}</span>
        </div>
        <div className="mcRuntimeProviderRow">
          <span>{t.runtimeEngine.modelsCount}</span>
          <span className="mcMono">{provider.models.length}</span>
        </div>

        <div className="mcRuntimeCapabilityRow">
          {provider.supportsStreaming ? (
            <span className="mcRuntimeCapability">{t.runtimeEngine.capabilities.streaming}</span>
          ) : null}
          {provider.supportsTools ? (
            <span className="mcRuntimeCapability">{t.runtimeEngine.capabilities.tools}</span>
          ) : null}
          {provider.supportsVision ? (
            <span className="mcRuntimeCapability">{t.runtimeEngine.capabilities.vision}</span>
          ) : null}
          {provider.supportsCode ? (
            <span className="mcRuntimeCapability">{t.runtimeEngine.capabilities.code}</span>
          ) : null}
          {provider.requiresApiKey ? (
            <span className="mcRuntimeCapability mcRuntimeCapabilityWarn">
              {t.runtimeEngine.requiresApiKey}
            </span>
          ) : null}
        </div>

        <ul className="mcRuntimeModelList">
          {provider.models.map((model) => (
            <li key={model.id} className="mcRuntimeModelListItem mcMono">
              {model.name} · {model.id}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
