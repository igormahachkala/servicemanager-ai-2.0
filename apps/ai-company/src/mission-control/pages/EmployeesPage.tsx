import {
  PageHeader,
  Panel,
  StatusDot,
  agentStatusClass,
  loadFillClass,
} from '../components/ui'
import { activeAgents, plannedAgents } from '../data/mock'
import { useI18n } from '../../i18n'

function statusDotKind(status: string, lifecycle: string): 'green' | 'amber' | 'red' | 'gray' {
  if (lifecycle === 'planned') return 'gray'
  if (status === 'online' || status === 'busy') return 'green'
  if (status === 'idle') return 'gray'
  return 'gray'
}

function AgentTable({
  rows,
  showLoad,
}: {
  rows: typeof activeAgents
  showLoad: boolean
}) {
  const { t } = useI18n()

  return (
    <table className="mcTable">
      <thead>
        <tr>
          <th>{t.labels.agent}</th>
          <th>{t.labels.role}</th>
          <th>Squad</th>
          <th>{t.labels.model}</th>
          <th>{t.labels.status}</th>
          <th>{t.labels.currentTask}</th>
          {showLoad ? <th>{t.labels.load}</th> : <th>{t.labels.lastActivity}</th>}
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
              {a.lifecycle === 'planned' ? t.labels.planned.toLowerCase() : a.status}
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
  const { t } = useI18n()

  return (
    <>
      <PageHeader title={t.pages.employees} description={t.employees.description} />

      <Panel
        title={t.labels.active}
        right={
          <span className="mcMono mcMuted">
            {activeAgents.length} {t.employees.agents}
          </span>
        }
      >
        <AgentTable rows={activeAgents} showLoad />
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel
          title={t.labels.planned}
          right={
            <span className="mcMono mcMuted">
              {plannedAgents.length} {t.employees.agents}
            </span>
          }
        >
          <AgentTable rows={plannedAgents} showLoad={false} />
        </Panel>
      </div>
    </>
  )
}
