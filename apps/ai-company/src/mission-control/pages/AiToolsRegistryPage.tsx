import { PageHeader, Panel, StatusDot, toolStatusDot } from '../components/ui'
import { tools, toolsByCategory } from '../data/mock'
import type { Tool, ToolCategory } from '../data/types'
import { useI18n } from '../../i18n'

function ToolTable({ rows }: { rows: Tool[] }) {
  const { t } = useI18n()

  return (
    <table className="mcTable">
      <thead>
        <tr>
          <th>{t.labels.name}</th>
          <th>{t.labels.version}</th>
          <th>{t.labels.scope}</th>
          <th>{t.labels.status}</th>
          <th>{t.labels.lastCheck}</th>
          <th>{t.labels.usedBy}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((tool) => (
          <tr key={tool.id}>
            <td>
              <span className="mcRowFlex">
                <StatusDot kind={toolStatusDot(tool.status)} />
                <span style={{ fontWeight: 600 }}>{tool.name}</span>
              </span>
            </td>
            <td className="mcMono">{tool.version}</td>
            <td className="mcMono mcMuted">{tool.scope}</td>
            <td className="mcMono">{t.toolStatus[tool.status]}</td>
            <td className="mcMono mcMuted">{tool.lastCheck}</td>
            <td className="mcMuted">{tool.usedBy.join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AiToolsRegistryPage() {
  const { t } = useI18n()
  const healthy = tools.filter((item) => item.status === 'healthy').length

  const categories: { id: ToolCategory; title: string; description: string }[] = [
    { id: 'models', title: t.labels.models, description: t.tools.modelsDescription },
    { id: 'coding-agents', title: t.labels.codingAgents, description: t.tools.codingAgentsDescription },
    { id: 'integrations', title: t.labels.integrations, description: t.tools.integrationsDescription },
  ]

  return (
    <>
      <PageHeader title={t.pages.toolsRegistry} description={t.tools.pageDescription} />

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.tools.registered}</div>
          <div className="mcMetricValue">{tools.length}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.tools.healthy}</div>
          <div className="mcMetricValue">{healthy}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.tools.categories}</div>
          <div className="mcMetricValue">3</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.tools.degraded}</div>
          <div className="mcMetricValue">{tools.filter((item) => item.status === 'degraded').length}</div>
        </div>
      </div>

      <div className="mcStack">
        {categories.map((cat) => (
          <Panel
            key={cat.id}
            title={cat.title}
            right={
              <span className="mcMono mcMuted">
                {toolsByCategory(cat.id).length} {t.tools.items}
              </span>
            }
          >
            <p className="mcMuted" style={{ padding: '12px 16px 0', margin: 0, fontSize: 12 }}>
              {cat.description}
            </p>
            <ToolTable rows={toolsByCategory(cat.id)} />
          </Panel>
        ))}
      </div>
    </>
  )
}
