import { Link } from 'react-router-dom'
import { WorkdayDailySummaryPanel, WorkdayDashboardPanel, WorkdayPhaseTracker } from '../components/workday'
import { useWorkday } from '../hooks/useWorkday'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function WorkdayPage() {
  const { t } = useI18n()
  const { dashboard, start, advance, finish, sync } = useWorkday()

  return (
    <div className="acWorkdayPage">
      <div className="mcPageHeaderRow">
        <PageHeader title={t.workdayEngine.title} description={t.workdayEngine.pageDescription} />
        <div className="acWorkdayHeaderActions">
          <button type="button" className="mcBtn mcBtnSecondary" onClick={sync}>
            {t.workdayEngine.actions.sync}
          </button>
          <Link to="/ops/presence" className="mcBtn mcBtnSecondary">
            {t.pages.presence}
          </Link>
          <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
            {t.pages.companyTimeline}
          </Link>
          <Link to="/ops/sprint" className="mcBtn mcBtnSecondary">
            {t.pages.sprint}
          </Link>
          <Link to="/ops/execution" className="mcBtn mcBtnSecondary">
            {t.pages.execution}
          </Link>
          <Link to="/ops/reports" className="mcBtn mcBtnSecondary">
            {t.pages.reports}
          </Link>
        </div>
      </div>

      <Panel title={t.workdayEngine.summary.title}>
        <WorkdayDailySummaryPanel
          summary={dashboard.summary}
          scheduledStartAt={dashboard.scheduledStartAt}
        />
      </Panel>

      <Panel title={t.workdayEngine.flowTitle}>
        <WorkdayPhaseTracker currentPhase="execute_tasks" />
        <p className="acMuted acWorkdayFlowNote">{t.workdayEngine.flowNote}</p>
      </Panel>

      <WorkdayDashboardPanel
        started={dashboard.started}
        idle={dashboard.idle}
        blocked={dashboard.blocked}
        finished={dashboard.finished}
        notStarted={dashboard.notStarted}
        onStart={start}
        onAdvance={advance}
        onFinish={finish}
      />

      <p className="mcMemoryLocalNote">{t.workdayEngine.localOnly}</p>
    </div>
  )
}
