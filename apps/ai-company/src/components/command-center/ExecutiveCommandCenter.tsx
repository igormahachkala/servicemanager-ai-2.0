import { PageHeader } from '../layout'
import { useCommandCenter } from '../../hooks/useCommandCenter'
import { useI18n } from '../../i18n'
import { MorningBrief } from './MorningBrief'
import { CompanyHealthPanel } from './CompanyHealthPanel'
import { EmployeesWorkingPanel } from './EmployeesWorkingPanel'
import { TodaysSprintPanel } from './TodaysSprintPanel'
import { CommandApprovalsPanel } from './CommandApprovalsPanel'
import { CriticalAlertsPanel } from './CriticalAlertsPanel'
import { RuntimePanel } from './RuntimePanel'
import { ToolUsagePanel } from './ToolUsagePanel'
import { RecentReportsPanel } from './RecentReportsPanel'
import { LiveTimelinePanel } from './LiveTimelinePanel'
import { CanvasPreviewPanel } from './CanvasPreviewPanel'
import { ControlRoomPreviewPanel } from './ControlRoomPreviewPanel'
import { NotificationsPanel } from './NotificationsPanel'
import { QuickLaunchBar, CommandChartsPanel } from './QuickLaunchBar'
import { WorkSchedulerCommandPanel } from './WorkSchedulerCommandPanel'
import { RuntimeCostMonitorPanel } from '../runtime-monitor'

export function ExecutiveCommandCenter() {
  const { t } = useI18n()
  const { snapshot, unreadCount, markRead } = useCommandCenter()

  return (
    <>
      <PageHeader title={t.commandCenter.title} description={t.commandCenter.description} />
      <QuickLaunchBar />
      <MorningBrief brief={snapshot.brief} healthScore={snapshot.healthScore} />

      <div className="mcCommandCenterGrid">
        <div className="mcCommandCenterSpan4">
          <CompanyHealthPanel
            healthScore={snapshot.healthScore}
            systemHealth={snapshot.systemHealth}
          />
        </div>
        <div className="mcCommandCenterSpan8">
          <CommandChartsPanel charts={snapshot.charts} />
        </div>

        <div className="mcCommandCenterSpan6">
          <EmployeesWorkingPanel
            working={snapshot.employeesWorking}
            waiting={snapshot.employeesWaiting}
          />
        </div>
        <div className="mcCommandCenterSpan6">
          <TodaysSprintPanel sprint={snapshot.sprint} />
        </div>

        <div className="mcCommandCenterSpan6">
          <CommandApprovalsPanel
            pending={snapshot.pendingApprovals}
            stats={snapshot.approvalStats}
          />
        </div>
        <div className="mcCommandCenterSpan6">
          <WorkSchedulerCommandPanel />
        </div>
        <div className="mcCommandCenterSpan6">
          <CriticalAlertsPanel alerts={snapshot.criticalAlerts} />
        </div>

        <div className="mcCommandCenterSpan4">
          <RuntimePanel runtime={snapshot.runtime} />
        </div>
        <div className="mcCommandCenterSpan8">
          <RuntimeCostMonitorPanel />
        </div>
        <div className="mcCommandCenterSpan4">
          <ToolUsagePanel toolUsage={snapshot.toolUsage} />
        </div>
        <div className="mcCommandCenterSpan4">
          <RecentReportsPanel reports={snapshot.reports} />
        </div>

        <div className="mcCommandCenterSpan6">
          <CanvasPreviewPanel canvas={snapshot.canvas} />
        </div>
        <div className="mcCommandCenterSpan6">
          <ControlRoomPreviewPanel controlRoom={snapshot.controlRoom} />
        </div>

        <div className="mcCommandCenterSpan8">
          <LiveTimelinePanel events={snapshot.timeline} />
        </div>
        <div className="mcCommandCenterSpan4">
          <NotificationsPanel
            notifications={snapshot.notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
          />
        </div>
      </div>
    </>
  )
}
