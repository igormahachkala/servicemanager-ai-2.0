import { Link } from 'react-router-dom'
import { EmployeeStatusBadge } from '../presence'
import { RuntimeStatusBadge } from '../runtime/RuntimeStatusBadge'
import { resolveLivingActivityForEmployee, resolveLivingActivityFromRun } from '../../domain/living'
import { getModelById } from '../../domain/runtime/runtimeStorage'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { LivingActivityLine, RecentActivityStrip } from '../living'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function WorkspaceOverview({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()
  const model = getModelById(snapshot.profile.primaryModelId)
  const { employee, presence, profile } = snapshot
  const living = snapshot.currentRun
    ? resolveLivingActivityFromRun(snapshot.currentRun)
    : resolveLivingActivityForEmployee(employee.id)

  return (
    <Panel title={t.employeeWorkspace.sections.overview}>
      <div className="acWorkspaceOverview mcProfilePanelBody">
        <div className="acWorkspaceIdentity">
          <div className="acWorkspaceAvatar" aria-hidden>
            {employee.codename.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="acWorkspaceName">{employee.name}</h2>
            <div className="acWorkspaceMeta">
              <span className="mcMono">{employee.codename}</span>
              <span className="mcMuted">·</span>
              <span>{employee.role}</span>
            </div>
            <div className="acWorkspaceBadges">
              <RuntimeStatusBadge status={profile.status} compact />
              {presence ? <EmployeeStatusBadge status={presence.status} compact /> : null}
            </div>
          </div>
          <Link to={`/ops/employees/${employee.id}`} className="mcBtn mcBtnSecondary mcBtnSm">
            {t.employeeWorkspace.openProfile}
          </Link>
        </div>

        {living ? (
          <div className="acWorkspaceLiving">
            <span className="mcFieldLabel">{t.livingCompany.doingNow}</span>
            <LivingActivityLine snapshot={living} showProgress={living.progress !== null} />
          </div>
        ) : (
          <p className="acWorkspaceSummary">{t.employeeWorkspace.overviewSummary}</p>
        )}

        <div className="acWorkspaceMetricGrid">
          <div className="acWorkspaceMetric">
            <span className="acWorkspaceMetricLabel">{t.employeeWorkspace.fields.primaryModel}</span>
            <span className="acWorkspaceMetricValue">{model?.name ?? profile.primaryModelId}</span>
          </div>
          <div className="acWorkspaceMetric">
            <span className="acWorkspaceMetricLabel">{t.employeeWorkspace.fields.currentFocus}</span>
            <span className="acWorkspaceMetricValue">
              {presence?.activity || t.employeeWorkspace.noCurrentFocus}
            </span>
          </div>
          <div className="acWorkspaceMetric">
            <span className="acWorkspaceMetricLabel">{t.employeeWorkspace.fields.openTasks}</span>
            <span className="acWorkspaceMetricValue">{snapshot.tasks.length}</span>
          </div>
          <div className="acWorkspaceMetric">
            <span className="acWorkspaceMetricLabel">{t.employeeWorkspace.fields.pendingDecisions}</span>
            <span className="acWorkspaceMetricValue">
              {snapshot.approvals.length + snapshot.pendingHandoffs.length}
            </span>
          </div>
        </div>

        <div className="acWorkspaceSubsection">
          <span className="mcFieldLabel">{t.livingCompany.recentActivity}</span>
          <RecentActivityStrip events={snapshot.activityEvents} limit={4} compact />
        </div>
      </div>
    </Panel>
  )
}
