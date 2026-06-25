import { Link } from 'react-router-dom'
import type { RegistryTool } from '../../data/tools'
import { TOOL_CATEGORY_META } from '../../data/toolCategories'
import { ToolConnectionStatus } from './ToolConnectionStatus'
import { useI18n } from '../../../i18n'

export function ToolCard(props: { tool: RegistryTool }) {
  const { t } = useI18n()
  const { tool } = props
  const categoryMeta = TOOL_CATEGORY_META[tool.category]

  return (
    <article className="mcToolCard">
      <div className="mcToolCardHead">
        <span className="mcToolCardIcon" aria-hidden>
          {categoryMeta.icon}
        </span>
        <div className="mcToolCardTitleBlock">
          <h3 className="mcToolCardTitle">{tool.name}</h3>
          <span className="mcToolCardCategory mcMono">
            {t.toolRegistry.categories[tool.category]}
          </span>
        </div>
        <ToolConnectionStatus status={tool.connectionStatus} />
      </div>

      <p className="mcToolCardDesc">
        {t.toolRegistry.descriptions[tool.descriptionKey as keyof typeof t.toolRegistry.descriptions]}
      </p>

      <div className="mcToolCardMeta">
        <span className="mcMono mcMuted">
          {t.toolRegistry.providers[tool.provider]} · {tool.capabilities.length}{' '}
          {t.toolRegistry.capabilityCount}
        </span>
        {tool.requiresApproval ? (
          <span className="mcToolBadge mcToolBadgeWarn">{t.toolRegistry.requiresApproval}</span>
        ) : null}
      </div>

      <Link to={`/ops/tools/${tool.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.toolRegistry.openTool}
      </Link>
    </article>
  )
}
