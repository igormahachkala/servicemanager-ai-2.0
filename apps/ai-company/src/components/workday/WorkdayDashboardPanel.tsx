import type { WorkdayDashboardEntry } from '../../domain/workday'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'
import { WorkdayEmployeeCard } from './WorkdayEmployeeCard'

function WorkdayBucketPanel(props: {
  title: string
  entries: WorkdayDashboardEntry[]
  emptyLabel: string
  onStart?: (employeeId: string) => void
  onAdvance?: (employeeId: string) => void
  onFinish?: (employeeId: string) => void
}) {
  return (
    <Panel title={props.title}>
      {props.entries.length === 0 ? (
        <p className="acMuted">{props.emptyLabel}</p>
      ) : (
        <div className="acWorkdayCardGrid">
          {props.entries.map((entry) => (
            <WorkdayEmployeeCard
              key={entry.workday.id}
              entry={entry}
              onStart={props.onStart}
              onAdvance={props.onAdvance}
              onFinish={props.onFinish}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

export function WorkdayDashboardPanel(props: {
  started: WorkdayDashboardEntry[]
  idle: WorkdayDashboardEntry[]
  blocked: WorkdayDashboardEntry[]
  finished: WorkdayDashboardEntry[]
  notStarted: WorkdayDashboardEntry[]
  onStart?: (employeeId: string) => void
  onAdvance?: (employeeId: string) => void
  onFinish?: (employeeId: string) => void
}) {
  const { t } = useI18n()

  return (
    <div className="acWorkdayDashboardGrid">
      <WorkdayBucketPanel
        title={t.workdayEngine.dashboard.started}
        entries={props.started}
        emptyLabel={t.workdayEngine.dashboard.noStarted}
        onStart={props.onStart}
        onAdvance={props.onAdvance}
        onFinish={props.onFinish}
      />
      <WorkdayBucketPanel
        title={t.workdayEngine.dashboard.idle}
        entries={props.idle}
        emptyLabel={t.workdayEngine.dashboard.noIdle}
        onStart={props.onStart}
        onAdvance={props.onAdvance}
        onFinish={props.onFinish}
      />
      <WorkdayBucketPanel
        title={t.workdayEngine.dashboard.blocked}
        entries={props.blocked}
        emptyLabel={t.workdayEngine.dashboard.noBlocked}
        onStart={props.onStart}
        onAdvance={props.onAdvance}
        onFinish={props.onFinish}
      />
      <WorkdayBucketPanel
        title={t.workdayEngine.dashboard.finished}
        entries={props.finished}
        emptyLabel={t.workdayEngine.dashboard.noFinished}
        onStart={props.onStart}
        onAdvance={props.onAdvance}
        onFinish={props.onFinish}
      />
      <div className="acWorkdayDashboardSpanFull">
        <WorkdayBucketPanel
          title={t.workdayEngine.dashboard.notStarted}
          entries={props.notStarted}
          emptyLabel={t.workdayEngine.dashboard.noNotStarted}
          onStart={props.onStart}
          onAdvance={props.onAdvance}
          onFinish={props.onFinish}
        />
      </div>
    </div>
  )
}
