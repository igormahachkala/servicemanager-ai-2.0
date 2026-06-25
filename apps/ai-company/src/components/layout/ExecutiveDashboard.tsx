import { Link } from 'react-router-dom'
import { Badge, Card, DataTable, PageHeader } from './index'
import { recentAlerts, systemHealth } from '../../mission-control/data/mock'
import { StatusDot, formatFeedTime, healthDot } from '../../mission-control/components/ui'
import { useApprovals } from '../../hooks/useApprovals'
import { useChats } from '../../hooks/useChats'
import { useEvents } from '../../hooks/useEvents'
import { useReports } from '../../hooks/useReports'
import { useRuntime } from '../../hooks/useRuntime'
import { useRuntimeProfiles } from '../../hooks/useRuntimeProfiles'
import { useActiveWorkspace } from '../../hooks/useActiveWorkspace'
import { useProjects } from '../../hooks/useProjects'
import { useWorkspaces } from '../../hooks/useWorkspaces'
import { useCustomEmployees } from '../../mission-control/hooks/useCustomEmployees'
import { useI18n } from '../../i18n'

export function ExecutiveDashboard() {
  const { t } = useI18n()
  const { employees } = useCustomEmployees()
  const { stats: runtimeStats } = useRuntime()
  const { stats: profileStats } = useRuntimeProfiles()
  const { stats: approvalStats } = useApprovals()
  const { reports } = useReports()
  const { grouped } = useEvents()
  const { chats } = useChats()
  const { workspaces } = useWorkspaces()
  const { projects } = useProjects()
  const { activeWorkspace } = useActiveWorkspace()

  const alerts = recentAlerts()
  const recentEvents = grouped.flatMap((group) => group.events).slice(0, 5)

  const eventLabel = (metadata: (typeof recentEvents)[number]['metadata']) => {
    if (typeof metadata.message === 'string') return metadata.message
    if (typeof metadata.preview === 'string') return metadata.preview
    if (typeof metadata.title === 'string') return metadata.title
    if (typeof metadata.subject === 'string') return metadata.subject
    return t.executiveDashboard.eventFallback
  }
  const recentChats = [...chats]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  return (
    <>
      <PageHeader title={t.executiveDashboard.title} description={t.executiveDashboard.description} />

      <div className="acDashboardGrid acDashboardGridMetrics" style={{ marginBottom: 16 }}>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.executiveDashboard.employees}</div>
          <div className="acMetricTileValue">{employees.length}</div>
          <div className="acMetricTileSub">{t.executiveDashboard.employeesSub}</div>
        </div>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.executiveDashboard.currentRuntime}</div>
          <div className="acMetricTileValue">{runtimeStats.total}</div>
          <div className="acMetricTileSub">
            {t.executiveDashboard.runtimeSub
              .replace('{active}', String(profileStats.active))
              .replace('{waiting}', String(runtimeStats.waitingApproval))}
          </div>
        </div>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.executiveDashboard.approvals}</div>
          <div className="acMetricTileValue">{approvalStats.pending}</div>
          <div className="acMetricTileSub">{t.executiveDashboard.approvalsSub}</div>
        </div>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.executiveDashboard.reports}</div>
          <div className="acMetricTileValue">{reports.length}</div>
          <div className="acMetricTileSub">{t.executiveDashboard.reportsSub}</div>
        </div>
      </div>

      <div className="acDashboardGrid acDashboardGridMain">
        <div className="acDashboardSpan8">
          <Card
            title={t.executiveDashboard.companyHealth}
            action={<Link to="/ops/tools" className="acLink">{t.executiveDashboard.viewAll}</Link>}
          >
            <div className="acHealthRow">
              {systemHealth.map((item) => (
                <div key={item.id} className="acHealthItem">
                  <StatusDot kind={healthDot(item.status)} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.label}</div>
                    <div className="acMono acMuted">{item.detail}</div>
                  </div>
                  <Badge variant={item.status === 'up' ? 'success' : 'warning'}>{item.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="acDashboardSpan4">
          <Card title={t.executiveDashboard.projectsOverview}>
            <div className="acMetricTileValue" style={{ fontSize: 20 }}>
              {projects.length}
            </div>
            <div className="acMetricTileSub">{t.executiveDashboard.projectsSub}</div>
            <Link to="/ops/projects" className="acLink" style={{ marginTop: 8, display: 'inline-block' }}>
              {t.executiveDashboard.viewAll}
            </Link>
          </Card>
        </div>

        <div className="acDashboardSpan4">
          <Card title={t.executiveDashboard.workspaceOverview}>
            <div style={{ marginBottom: 12 }}>
              <div className="acMuted" style={{ fontSize: 11, marginBottom: 4 }}>
                {t.workspaces.selector.label}
              </div>
              <div style={{ fontWeight: 600 }}>{activeWorkspace?.name ?? t.workspaces.selector.none}</div>
            </div>
            <div className="acMetricTileValue" style={{ fontSize: 20 }}>
              {workspaces.length}
            </div>
            <div className="acMetricTileSub">{t.executiveDashboard.workspacesSub}</div>
          </Card>
        </div>

        <div className="acDashboardSpan6">
          <Card
            title={t.executiveDashboard.timeline}
            action={<Link to="/ops/timeline" className="acLink">{t.executiveDashboard.viewAll}</Link>}
          >
            {recentEvents.length === 0 ? (
              <div className="acMuted">{t.executiveDashboard.noData}</div>
            ) : (
              recentEvents.map((event) => (
                <div key={event.id} className="acListRow">
                  <span className="acMono acMuted">{formatFeedTime(event.createdAt)}</span>
                  <span>{eventLabel(event.metadata)}</span>
                  <Badge variant={event.severity === 'error' ? 'danger' : 'default'}>
                    {event.type}
                  </Badge>
                </div>
              ))
            )}
          </Card>
        </div>

        <div className="acDashboardSpan6">
          <Card
            title={t.executiveDashboard.recentChats}
            action={<Link to="/ops/chats" className="acLink">{t.executiveDashboard.viewAll}</Link>}
          >
            {recentChats.length === 0 ? (
              <div className="acMuted">{t.executiveDashboard.noData}</div>
            ) : (
              <DataTable>
                <tbody>
                  {recentChats.map((chat) => (
                    <tr key={chat.id}>
                      <td>
                        <Link to={`/ops/chats/${encodeURIComponent(chat.id)}`} className="acLink">
                          {chat.title}
                        </Link>
                      </td>
                      <td className="acMono acMuted">{formatFeedTime(chat.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </Card>
        </div>

        <div className="acDashboardSpan6">
          <Card
            title={t.executiveDashboard.criticalAlerts}
            action={<Link to="/ops/approvals" className="acLink">{t.executiveDashboard.viewAll}</Link>}
          >
            {alerts.length === 0 ? (
              <div className="acMuted">{t.dashboard.noActiveAlerts}</div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="acListRow">
                  <StatusDot kind={alert.severity === 'error' ? 'red' : 'amber'} />
                  <span className="acMono acMuted">{formatFeedTime(alert.at)}</span>
                  <span>{alert.message}</span>
                </div>
              ))
            )}
          </Card>
        </div>

        <div className="acDashboardSpan6">
          <Card title={t.executiveDashboard.quickActions}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Link to="/ops/chats/new" className="acQuickActionBtn acQuickActionBtnPrimary">
                {t.executiveDashboard.actionNewChat}
              </Link>
              <Link to="/ops/employees/new" className="acQuickActionBtn">
                {t.executiveDashboard.actionNewEmployee}
              </Link>
              <Link to="/ops/projects/new" className="acQuickActionBtn">
                {t.executiveDashboard.actionNewProject}
              </Link>
              <Link to="/ops/tasks" className="acQuickActionBtn">
                {t.executiveDashboard.actionTasks}
              </Link>
              <Link to="/ops/runtime" className="acQuickActionBtn">
                {t.platformNav.settings}
              </Link>
              <Link to="/" className="acQuickActionBtn">
                {t.executiveDashboard.actionFlow}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
