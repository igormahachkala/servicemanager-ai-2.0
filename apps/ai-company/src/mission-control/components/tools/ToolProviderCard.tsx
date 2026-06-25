import type { ToolRegistryProvider } from '../../data/toolProviders'
import type { RegistryTool } from '../../data/tools'
import { useI18n } from '../../../i18n'

export function ToolProviderCard(props: {
  provider: ToolRegistryProvider
  tools: RegistryTool[]
}) {
  const { t } = useI18n()
  const connected = props.tools.filter((tool) => tool.connectionStatus === 'connected').length

  return (
    <article className="mcToolProviderCard">
      <div className="mcToolProviderCardTitle">{t.toolRegistry.providers[props.provider]}</div>
      <p className="mcToolProviderCardDesc">
        {t.toolRegistry.providerDescriptions[props.provider]}
      </p>
      <div className="mcToolProviderCardMeta mcMono mcMuted">
        {props.tools.length} {t.toolRegistry.toolsCount} · {connected} {t.toolRegistry.connectedCount}
      </div>
    </article>
  )
}
