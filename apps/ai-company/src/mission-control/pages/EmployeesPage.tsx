import {
  PageHeader,
  Panel,
  StatusDot,
  agentStatusClass,
  loadFillClass,
} from '../components/ui'
import { activeAgents, plannedAgents } from '../data/mock'

function statusDotKind(status: string, lifecycle: string): 'green' | 'amber' | 'red' | 'gray' {
  if (lifecycle === 'planned') return 'gray'
  if (status === 'online' || status === 'busy') return 'green'
  if (status === 'idle') return 'gray'
  return 'gray'
}

function AgentTable({ rows, showLoad }: { rows: typeof activeAgents; showLoad: boolean }) {
  return (
    <table className="mcTable">
      <thead>
        <tr>
          <th>Agent</th>
          <th>Role</th>
          <th>Squad</th>
          <th>Model</th>
          <th>Status</th>
          <th>Current task</th>
          {showLoad ? <th>Load</th> : <th>Last activity</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id} style={{ opacity: a.lifecycle === 'planned' ? 0.65 : 1 }}>
            <td>
              <span className="mcRowFlex">
                <StatusDot kind={statusDotKind(a.status, a.lifecycle)} />
                <span className="mcMono" style={{ fontWeight: 600 }}>
                  {a.codename}
                </span>
              </span>
            </td>
            <td>{a.role}</td>
            <td className="mcMuted">{a.squad}</td>
            <td className="mcMono mcMuted">{a.model}</td>
            <td className={agentStatusClass(a.lifecycle === 'planned' ? 'offline' : a.status)}>
              {a.lifecycle === 'planned' ? 'planned' : a.status}
            </td>
            <td className="mcMono">{a.currentTaskId ?? '—'}</td>
            <td>
              {showLoad ? (
                <div className="mcRowFlex">
                  <div className="mcLoadBar">
                    <div className={loadFillClass(a.loadPct)} style={{ width: `${a.loadPct}%` }} />
                  </div>
                  <span className="mcMono mcMuted">{a.loadPct}%</span>
                </div>
              ) : (
                <span className="mcMuted" style={{ fontSize: 12 }}>
                  {a.lastActivity}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function EmployeesPage() {
  return (
    <>
      <PageHeader
        title="Employees"
        description="V1 agent roster — active agents run now; planned agents visible for org design."
      />

      <Panel title="Active" right={<span className="mcMono mcMuted">{activeAgents.length} agents</span>}>
        <AgentTable rows={activeAgents} showLoad />
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel title="Planned" right={<span className="mcMono mcMuted">{plannedAgents.length} agents</span>}>
          <AgentTable rows={plannedAgents} showLoad={false} />
        </Panel>
      </div>
    </>
  )
}
