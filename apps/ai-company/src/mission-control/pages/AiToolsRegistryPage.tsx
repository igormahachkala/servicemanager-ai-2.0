import { PageHeader, Panel, StatusDot, toolStatusDot } from '../components/ui'
import { tools, toolsByCategory } from '../data/mock'
import type { ToolCategory } from '../data/types'
import { useI18n } from '../../i18n'

function ToolTable({ rows }: { rows: ReturnType<typeof toolsByCategory> }) {
  return (
    <table className="mcTable">
      <thead>
        <tr>
          <th>Name</th>
          <th>Version</th>
          <th>Scope</th>
          <th>Status</th>
          <th>Last check</th>
          <th>Used by</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id}>
            <td>
              <span className="mcRowFlex">
                <StatusDot kind={toolStatusDot(t.status)} />
                <span style={{ fontWeight: 600 }}>{t.name}</span>
              </span>
            </td>
            <td className="mcMono">{t.version}</td>
            <td className="mcMono mcMuted">{t.scope}</td>
            <td className="mcMono">{t.status}</td>
            <td className="mcMono mcMuted">{t.lastCheck}</td>
            <td className="mcMuted">{t.usedBy.join(', ')}</td>
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
          <div className="mcMetricLabel">Registered</div>
          <div className="mcMetricValue">{tools.length}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">Healthy</div>
          <div className="mcMetricValue">{healthy}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">Categories</div>
          <div className="mcMetricValue">3</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">Degraded</div>
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
