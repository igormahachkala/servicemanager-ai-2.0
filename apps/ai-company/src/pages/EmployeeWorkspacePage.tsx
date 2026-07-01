import { Link, useParams } from 'react-router-dom'
import {
  AssignedKnowledge,
  CurrentRun,
  CurrentTasks,
  QuickActions,
  RecentChats,
  RecentReports,
  TodayAgenda,
  WorkspaceApprovals,
  WorkspaceNotifications,
  WorkspaceOverview,
  WorkdayWorkspacePanel,
} from '../components/workspace'
import { NextSuggestedActionsPanel } from '../components/work-scheduler'
import { useEmployeeWorkspace } from '../hooks/useEmployeeWorkspace'
import { useWorkScheduler } from '../hooks/useWorkScheduler'
import { resolveCanonicalEmployeeId } from '../mission-control/data/employeeIdResolver'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { PageGuideCard } from '../components/guided'
import { useI18n } from '../i18n'

export function EmployeeWorkspacePage() {
  const { id: routeId } = useParams<{ id: string }>()
  const employeeId = routeId ? resolveCanonicalEmployeeId(routeId) : undefined
  const { t } = useI18n()
  const { snapshot } = useEmployeeWorkspace(employeeId)
  const { pending, approve, dismiss } = useWorkScheduler({ employeeId: employeeId ?? null })

  if (!employeeId || !snapshot) {
    return (
      <>
        <PageHeader
          title={t.employeeWorkspace.notFoundTitle}
          description={t.employeeWorkspace.notFoundDescription}
        />
        <Link to="/ops/employees" className="mcBtn mcBtnPrimary">
          {t.employeeProfile.backToEmployees}
        </Link>
      </>
    )
  }

  return (
    <div className="acEmployeeWorkspacePage">
      <div className="mcPageHeaderRow">
        <PageHeader
          title={t.employeeWorkspace.pageTitle.replace('{name}', snapshot.employee.codename)}
          description={t.employeeWorkspace.pageDescription}
        />
        <Link to={`/ops/employees/${employeeId}`} className="mcBtn mcBtnSecondary">
          {t.employeeWorkspace.openProfile}
        </Link>
        <Link to={`/ops/employees/${employeeId}/runtime`} className="mcBtn mcBtnSecondary">
          {t.employeeWorkspace.openRuntime}
        </Link>
        <Link
          to={`/ops/run-task?employee=${encodeURIComponent(employeeId)}&project=${encodeURIComponent('project-ai-photo-lab')}&workspace=${encodeURIComponent('workspace-ai-photo-lab')}`}
          className="mcBtn mcBtnPrimary"
        >
          {t.taskRunner.actions.openRunTask}
        </Link>
        <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
          {t.pages.companyTimeline}
        </Link>
        <Link to="/ops/workday" className="mcBtn mcBtnSecondary">
          {t.pages.workday}
        </Link>
      </div>

      <PageGuideCard pageId="workspace" />

      <QuickActions snapshot={snapshot} />

      <div className="acWorkspaceTop">
        <WorkspaceOverview snapshot={snapshot} />
      </div>

      <div className="acWorkspaceGrid">
        <Panel title={t.workScheduler.title}>
          <div className="mcProfilePanelBody">
            <NextSuggestedActionsPanel
              plan={null}
              pending={pending}
              compact
              onApprove={approve}
              onDismiss={dismiss}
            />
          </div>
        </Panel>
        <WorkdayWorkspacePanel employeeId={employeeId} />
        <TodayAgenda snapshot={snapshot} />
        <WorkspaceApprovals snapshot={snapshot} />
        <CurrentTasks snapshot={snapshot} />
        <AssignedKnowledge snapshot={snapshot} />
        <CurrentRun snapshot={snapshot} />
        <RecentReports snapshot={snapshot} />
        <RecentChats snapshot={snapshot} />
        <WorkspaceNotifications snapshot={snapshot} />
      </div>

      <p className="mcReportPrincipleNote">{t.employeeWorkspace.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.employeeWorkspace.localOnly}</p>
    </div>
  )
}
