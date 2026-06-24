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
import { useI18n } from '../../i18n'

export function DashboardPage() {
  const { t } = useI18n()
  const m = dashboardMetrics
  const alerts = recentAlerts()
  const active = runningTasks()

  return (
    <>
      <PageHeader title={t.pages.dashboard} description={t.dashboard.description} />

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <Metric label={t.dashboard.activeAgents} value={m.activeAgents} sub={t.dashboard.activeAgentsSub} />
        <Metric label={t.dashboard.runningTasks} value={m.runningTasks} sub={t.dashboard.runningTasksSub} />
        <Metric label={t.dashboard.queueDepth} value={m.queueDepth} sub={t.dashboard.queueDepthSub} />
        <Metric
          label={t.dashboard.toolsHealthy}
          value={`${m.toolsHealthy}/${m.toolsTotal}`}
          sub={t.dashboard.toolsHealthySub}
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
        <Panel title={t.dashboard.activeMissions}>
          <table className="mcTable">
            <thead>
              <tr>
                <th>{t.labels.id}</th>
                <th>{t.labels.title}</th>
                <th>{t.labels.assignee}</th>
                <th>{t.labels.sla}</th>
              </tr>
            </thead>
            <tbody>
              {active.map((task) => (
                <tr key={task.id}>
                  <td className="mcMono">{task.id}</td>
                  <td>{task.title}</td>
                  <td className="mcMono mcMuted">{task.assignee}</td>
                  <td className="mcMono">
                    {task.slaBreached ? (
                      <span style={{ color: 'var(--mc-red)' }}>{t.dashboard.slaBreach}</span>
                    ) : (
                      `${task.slaMinutes}m`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={t.dashboard.alerts}>
          <div className="mcAlertStrip" style={{ padding: 12 }}>
            {alerts.length === 0 ? (
              <div className="mcMuted">{t.dashboard.noActiveAlerts}</div>
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
