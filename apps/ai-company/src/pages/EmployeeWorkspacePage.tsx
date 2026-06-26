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
import { useEmployeeWorkspace } from '../hooks/useEmployeeWorkspace'
import { PageHeader } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function EmployeeWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { snapshot } = useEmployeeWorkspace(id)

  if (!id || !snapshot) {
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
        <Link to={`/ops/employees/${id}`} className="mcBtn mcBtnSecondary">
          {t.employeeWorkspace.openProfile}
        </Link>
        <Link to={`/ops/employees/${id}/runtime`} className="mcBtn mcBtnSecondary">
          {t.employeeWorkspace.openRuntime}
        </Link>
        <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
          {t.pages.companyTimeline}
        </Link>
        <Link to="/ops/workday" className="mcBtn mcBtnSecondary">
          {t.pages.workday}
        </Link>
      </div>

      <QuickActions snapshot={snapshot} />

      <div className="acWorkspaceTop">
        <WorkspaceOverview snapshot={snapshot} />
      </div>

      <div className="acWorkspaceGrid">
        <WorkdayWorkspacePanel employeeId={id} />
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
