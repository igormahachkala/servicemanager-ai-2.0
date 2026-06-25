import { Link } from 'react-router-dom'
import { Badge, Card } from '../layout'
import type { Project } from '../../domain/projects'
import { useApprovals } from '../../hooks/useApprovals'
import { useAssignments } from '../../hooks/useAssignments'
import { useChats } from '../../hooks/useChats'
import { useRuntime } from '../../hooks/useRuntime'
import { useI18n } from '../../i18n'
import { Milestones } from './Milestones'
import { ProjectReports } from './ProjectReports'
import { ProjectRuntime } from './ProjectRuntime'

export function ProjectOverview({ project }: { project: Project }) {
  const { t } = useI18n()
  const { stats: approvalStats } = useApprovals()
  const { stats: runtimeStats } = useRuntime()
  const { byWorkspace } = useAssignments()
  const { chats } = useChats()

  const assignmentCount = byWorkspace(project.workspaceId).length
  const openRisks = project.risks.filter((item) => item.status === 'open').length
  const doneMilestones = project.milestones.filter((item) => item.status === 'done').length
  const sprintProgress =
    project.milestones.length > 0
      ? Math.round((doneMilestones / project.milestones.length) * 100)
      : project.progress

  const recentChats = [...chats]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3)

  const healthVariant =
    project.progress >= 70 ? 'success' : project.progress >= 40 ? 'warning' : 'danger'

  return (
    <div className="acProjectOverview">
      <div className="acDashboardGrid acDashboardGridMetrics" style={{ marginBottom: 16 }}>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.projects.dashboard.health}</div>
          <div className="acMetricTileValue">{project.progress}%</div>
          <div className="acMetricTileSub">
            <Badge variant={healthVariant}>{t.projects.dashboard.healthSub}</Badge>
          </div>
        </div>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.projects.dashboard.sprintProgress}</div>
          <div className="acMetricTileValue">{sprintProgress}%</div>
          <div className="acMetricTileSub">
            {doneMilestones}/{project.milestones.length} {t.projects.dashboard.milestonesDone}
          </div>
        </div>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.projects.dashboard.runtimeQueue}</div>
          <div className="acMetricTileValue">{runtimeStats.total}</div>
          <div className="acMetricTileSub">
            {runtimeStats.waitingApproval} {t.projects.dashboard.waitingApproval}
          </div>
        </div>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.projects.dashboard.teamActivity}</div>
          <div className="acMetricTileValue">{assignmentCount}</div>
          <div className="acMetricTileSub">{t.projects.dashboard.assignmentsSub}</div>
        </div>
      </div>

      <div className="acDashboardGrid acDashboardGridMain">
        <div className="acDashboardSpan6">
          <Milestones project={project} />
        </div>
        <div className="acDashboardSpan6">
          <Card title={t.projects.dashboard.approvals}>
            <div className="acMetricTileValue" style={{ fontSize: 28 }}>
              {approvalStats.pending}
            </div>
            <div className="acMetricTileSub">{t.projects.dashboard.approvalsSub}</div>
            <Link to="/ops/approvals" className="acLink" style={{ marginTop: 8, display: 'inline-block' }}>
              {t.executiveDashboard.viewAll}
            </Link>
          </Card>
        </div>
        <div className="acDashboardSpan6">
          <ProjectRuntime project={project} />
        </div>
        <div className="acDashboardSpan6">
          <ProjectReports project={project} />
        </div>
        <div className="acDashboardSpan6">
          <Card title={t.projects.dashboard.recentDiscussions}>
            {recentChats.length === 0 ? (
              <div className="acMuted">{t.executiveDashboard.noData}</div>
            ) : (
              recentChats.map((chat) => (
                <div key={chat.id} className="acListRow">
                  <Link to={`/ops/chats/${encodeURIComponent(chat.id)}`} className="acLink">
                    {chat.title}
                  </Link>
                </div>
              ))
            )}
          </Card>
        </div>
        <div className="acDashboardSpan6">
          <Card title={t.projects.dashboard.risks}>
            <div className="acMetricTileValue" style={{ fontSize: 28 }}>
              {openRisks}
            </div>
            <div className="acMetricTileSub">{t.projects.dashboard.risksSub}</div>
          </Card>
        </div>
      </div>

      <div className="acProjectFuturePlaceholders">
        <span className="acMuted">{t.projects.future.label}:</span>
        {(['budget', 'client', 'invoices', 'releases'] as const).map((key) => (
          <span key={key} className="acProjectFutureBadge">
            {t.projects.future[key]}
          </span>
        ))}
      </div>
    </div>
  )
}
