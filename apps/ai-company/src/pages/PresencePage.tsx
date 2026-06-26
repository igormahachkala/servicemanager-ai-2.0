import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/layout'
import { Panel } from '../mission-control/components/ui'
import {
  CurrentWorkPanel,
  EmployeePresenceCard,
  WorkdayTimeline,
} from '../components/presence'
import { WorkdayDailySummaryPanel } from '../components/workday'
import { useAssignments } from '../hooks/useAssignments'
import { usePresence } from '../hooks/usePresence'
import { useReports } from '../hooks/useReports'
import { useWorkday } from '../hooks/useWorkday'
import { useI18n } from '../i18n'
import { isPresenceWorking } from '../domain/presence/presenceStats'

export function PresencePage() {
  const { t } = useI18n()
  const { stats, nowWorking, waiting, todayEvents, records } = usePresence()
  const { dashboard } = useWorkday()
  const { assignments } = useAssignments()
  const { reports } = useReports()

  const recentlyFinished = todayEvents.filter((item) => item.type === 'work_finished').slice(0, 6)
  const recentReports = reports.slice(0, 5)
  const activeAssignments = assignments.filter((item) => item.status === 'active').slice(0, 6)

  const featured = records.find((item) => isPresenceWorking(item.status)) ?? records[0] ?? null

  return (
    <>
      <PageHeader
        title={t.pages.presence}
        description={t.presence.pageDescription}
        actions={
          <Link to="/ops/workday" className="mcBtn mcBtnSecondary">
            {t.pages.workday}
          </Link>
        }
      />

      <Panel title={t.workdayEngine.summary.title}>
        <WorkdayDailySummaryPanel
          summary={dashboard.summary}
          scheduledStartAt={dashboard.scheduledStartAt}
        />
      </Panel>

      <div className="acDashboardGrid acDashboardGridMetrics" style={{ marginBottom: 16 }}>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.presence.dashboard.nowWorking}</div>
          <div className="acMetricTileValue">{stats.nowWorking}</div>
        </div>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.presence.dashboard.waiting}</div>
          <div className="acMetricTileValue">{stats.waiting}</div>
        </div>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.presence.dashboard.needsAttention}</div>
          <div className="acMetricTileValue">{stats.needsAttention}</div>
        </div>
        <div className="acMetricTile">
          <div className="acMetricTileLabel">{t.presence.dashboard.available}</div>
          <div className="acMetricTileValue">{stats.available}</div>
        </div>
      </div>

      <div className="acDashboardGrid acDashboardGridMain">
        <div className="acDashboardSpan6">
          <Panel title={t.presence.dashboard.nowWorking}>
            {nowWorking.length === 0 ? (
              <p className="acMuted">{t.presence.dashboard.noWorking}</p>
            ) : (
              <div className="acPresenceCardGrid">
                {nowWorking.map((presence) => (
                  <EmployeePresenceCard key={presence.employeeId} presence={presence} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="acDashboardSpan6">
          <Panel title={t.presence.dashboard.waiting}>
            {waiting.length === 0 ? (
              <p className="acMuted">{t.presence.dashboard.noWaiting}</p>
            ) : (
              <div className="acPresenceCardGrid">
                {waiting.map((presence) => (
                  <EmployeePresenceCard key={presence.employeeId} presence={presence} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="acDashboardSpan6">
          <Panel title={t.presence.dashboard.recentlyFinished}>
            <WorkdayTimeline
              events={recentlyFinished}
              emptyLabel={t.presence.dashboard.noFinished}
            />
          </Panel>
        </div>

        <div className="acDashboardSpan6">
          <Panel title={t.presence.dashboard.todaysActivity}>
            <WorkdayTimeline events={todayEvents.slice(0, 8)} />
          </Panel>
        </div>

        <div className="acDashboardSpan6">
          <Panel title={t.presence.dashboard.currentAssignment}>
            {activeAssignments.length === 0 ? (
              <p className="acMuted">{t.presence.dashboard.noAssignments}</p>
            ) : (
              <div className="acPresenceAssignmentList">
                {activeAssignments.map((assignment) => (
                  <div key={assignment.id} className="acListRow">
                    <span className="mcMono">{assignment.employeeId}</span>
                    <span>{assignment.role}</span>
                    <span className="mcMono acMuted">{assignment.loadPercent}%</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="acDashboardSpan6">
          <Card title={t.presence.dashboard.recentReports}>
            {recentReports.length === 0 ? (
              <div className="acMuted">{t.presence.dashboard.noReports}</div>
            ) : (
              recentReports.map((report) => (
                <div key={report.id} className="acListRow">
                  <Link to={`/ops/reports/${report.id}`} className="acLink">
                    {report.title}
                  </Link>
                </div>
              ))
            )}
          </Card>
        </div>

        {featured ? (
          <div className="acDashboardSpan12">
            <CurrentWorkPanel presence={featured} employeeId={featured.employeeId} />
          </div>
        ) : null}
      </div>

      <p className="mcMemoryLocalNote">{t.presence.localOnly}</p>
    </>
  )
}
