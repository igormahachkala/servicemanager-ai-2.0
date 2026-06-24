import {
  Metric,
  PageHeader,
  Panel,
  StatusDot,
  formatFeedTime,
  healthDot,
} from '../components/ui'
import {
  dashboardMetrics,
  recentAlerts,
  runningTasks,
  systemHealth,
} from '../data/mock'

export function DashboardPage() {
  const m = dashboardMetrics
  const alerts = recentAlerts()
  const active = runningTasks()

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Operational overview — company health, active missions, alerts."
      />

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <Metric label="Active agents" value={m.activeAgents} sub="of 7 registered" />
        <Metric label="Running tasks" value={m.runningTasks} sub="in flight now" />
        <Metric label="Queue depth" value={m.queueDepth} sub="backlog + blocked" />
        <Metric
          label="Tools healthy"
          value={`${m.toolsHealthy}/${m.toolsTotal}`}
          sub="registry probes ok"
        />
      </div>

      <div className="mcHealthRow" style={{ marginBottom: 16 }}>
        {systemHealth.map((h) => (
          <div key={h.id} className="mcHealthCard">
            <StatusDot kind={healthDot(h.status)} />
            <div>
              <div style={{ fontWeight: 600 }}>{h.label}</div>
              <div className="mcMono mcMuted">{h.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mcGrid2">
        <Panel title="Active missions">
          <table className="mcTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Assignee</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {active.map((t) => (
                <tr key={t.id}>
                  <td className="mcMono">{t.id}</td>
                  <td>{t.title}</td>
                  <td className="mcMono mcMuted">{t.assignee}</td>
                  <td className="mcMono">
                    {t.slaBreached ? (
                      <span style={{ color: 'var(--mc-red)' }}>breach</span>
                    ) : (
                      `${t.slaMinutes}m`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Alerts">
          <div className="mcAlertStrip" style={{ padding: 12 }}>
            {alerts.length === 0 ? (
              <div className="mcMuted">No active alerts</div>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="mcAlertRow">
                  <StatusDot kind={a.severity === 'error' ? 'red' : 'amber'} />
                  <span className="mcMono">{formatFeedTime(a.at)}</span>
                  <span>{a.message}</span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </>
  )
}
