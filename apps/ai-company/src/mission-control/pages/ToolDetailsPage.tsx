import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../components/ui'
import { CapabilityMatrix } from '../components/tools/CapabilityMatrix'
import { PolicyMatrix } from '../components/tools/PolicyMatrix'
import { ToolConnectionStatus } from '../components/tools/ToolConnectionStatus'
import { TOOL_CATEGORY_META } from '../data/toolCategories'
import { useTools } from '../hooks/useTools'
import { useI18n } from '../../i18n'

export function ToolDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { getById } = useTools()
  const tool = id ? getById(id) : null

  if (!tool) {
    return (
      <>
        <PageHeader
          title={t.toolRegistry.notFoundTitle}
          description={t.toolRegistry.notFoundDescription}
        />
        <div className="mcWorkspaceEmpty">
          <div className="mcWorkspaceEmptyTitle">{t.toolRegistry.notFoundTitle}</div>
          <p className="mcWorkspaceEmptyDesc">{t.toolRegistry.notFoundDescription}</p>
          <Link to="/ops/tools" className="mcBtn mcBtnPrimary">
            {t.toolRegistry.backToCatalog}
          </Link>
        </div>
      </>
    )
  }

  const categoryMeta = TOOL_CATEGORY_META[tool.category]

  return (
    <div className="mcToolDetailsPage">
      <div className="mcToolDetailsHeader">
        <Link to="/ops/tools" className="mcProfileBack">
          ← {t.toolRegistry.backToCatalog}
        </Link>
        <div className="mcToolDetailsTitleRow">
          <span className="mcToolDetailsIcon" aria-hidden>
            {categoryMeta.icon}
          </span>
          <div>
            <h1 className="mcToolDetailsTitle">{tool.name}</h1>
            <div className="mcToolDetailsSub mcMono mcMuted">
              {t.toolRegistry.categories[tool.category]} · {t.toolRegistry.providers[tool.provider]}
            </div>
          </div>
          <ToolConnectionStatus status={tool.connectionStatus} />
        </div>
        <p className="mcToolDetailsDesc">
          {t.toolRegistry.descriptions[tool.descriptionKey as keyof typeof t.toolRegistry.descriptions]}
        </p>
        <Link
          to={`/ops/tool-executions?tool=${encodeURIComponent(tool.id)}`}
          className="mcBtn mcBtnSecondary"
        >
          {t.pages.toolExecutions}
        </Link>
      </div>

      <div className="mcProfileGrid">
        <Panel title={t.toolRegistry.details.identity}>
          <div className="mcProfilePanelBody">
            <div className="mcProfileFieldGrid">
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.labels.id}</div>
                <div className="mcProfileFieldValue mcMono">{tool.id}</div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.toolRegistry.details.category}</div>
                <div className="mcProfileFieldValue">{t.toolRegistry.categories[tool.category]}</div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.toolRegistry.details.provider}</div>
                <div className="mcProfileFieldValue">{t.toolRegistry.providers[tool.provider]}</div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.toolRegistry.details.requiresApproval}</div>
                <div className="mcProfileFieldValue">
                  {tool.requiresApproval ? t.employeeProfile.yes : t.employeeProfile.no}
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.toolRegistry.details.workspaceScope}</div>
                <div className="mcProfileFieldValue">
                  {tool.supportsWorkspaceScope ? t.employeeProfile.yes : t.employeeProfile.no}
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.toolRegistry.details.audit}</div>
                <div className="mcProfileFieldValue">
                  {tool.supportsAudit ? t.employeeProfile.yes : t.employeeProfile.no}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t.toolRegistry.details.architecture}>
          <div className="mcProfilePanelBody">
            <p className="mcToolRegistryNote">{t.toolRegistry.employeeBoundaryNote}</p>
          </div>
        </Panel>
      </div>

      <Panel title={t.toolRegistry.details.capabilities}>
        <div className="mcProfilePanelBody">
          <CapabilityMatrix enabled={tool.capabilities} />
        </div>
      </Panel>

      <Panel title={t.toolRegistry.details.accessPolicies}>
        <div className="mcProfilePanelBody">
          <PolicyMatrix active={tool.permissions} />
        </div>
      </Panel>
    </div>
  )
}
