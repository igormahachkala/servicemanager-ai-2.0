import { PageHeader, Panel, StatusDot, toolStatusDot } from '../components/ui'
import { tools, toolsByCategory } from '../data/mock'
import type { ToolCategory } from '../data/types'

const CATEGORIES: { id: ToolCategory; title: string; description: string }[] = [
  { id: 'models', title: 'Models', description: 'LLM runtimes available to agents' },
  { id: 'coding-agents', title: 'Coding Agents', description: 'Autonomous coding and IDE agents' },
  { id: 'integrations', title: 'Integrations', description: 'MCP and infrastructure connectors' },
]

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
  const healthy = tools.filter((t) => t.status === 'healthy').length

  return (
    <>
      <PageHeader
        title="AI Tools Registry"
        description="Models, coding agents, and integrations — V1 local inventory."
      />

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
          <div className="mcMetricValue">{tools.filter((t) => t.status === 'degraded').length}</div>
        </div>
      </div>

      <div className="mcStack">
        {CATEGORIES.map((cat) => (
          <Panel
            key={cat.id}
            title={cat.title}
            right={<span className="mcMono mcMuted">{toolsByCategory(cat.id).length} items</span>}
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
