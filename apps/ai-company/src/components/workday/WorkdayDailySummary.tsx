import type { WorkdayDailySummary } from '../../domain/workday'
import { useI18n } from '../../i18n'

export function WorkdayDailySummaryPanel(props: { summary: WorkdayDailySummary; scheduledStartAt: string }) {
  const { t } = useI18n()
  const startTime = new Date(props.scheduledStartAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="acWorkdaySummaryGrid">
      <div className="acWorkdaySummaryTile">
        <div className="acWorkdaySummaryLabel">{t.workdayEngine.summary.scheduledStart}</div>
        <div className="acWorkdaySummaryValue">{startTime}</div>
      </div>
      <div className="acWorkdaySummaryTile">
        <div className="acWorkdaySummaryLabel">{t.workdayEngine.summary.started}</div>
        <div className="acWorkdaySummaryValue">{props.summary.startedCount}</div>
      </div>
      <div className="acWorkdaySummaryTile">
        <div className="acWorkdaySummaryLabel">{t.workdayEngine.summary.idle}</div>
        <div className="acWorkdaySummaryValue">{props.summary.idleCount}</div>
      </div>
      <div className="acWorkdaySummaryTile">
        <div className="acWorkdaySummaryLabel">{t.workdayEngine.summary.blocked}</div>
        <div className="acWorkdaySummaryValue">{props.summary.blockedCount}</div>
      </div>
      <div className="acWorkdaySummaryTile">
        <div className="acWorkdaySummaryLabel">{t.workdayEngine.summary.finished}</div>
        <div className="acWorkdaySummaryValue">{props.summary.finishedCount}</div>
      </div>
      <div className="acWorkdaySummaryTile">
        <div className="acWorkdaySummaryLabel">{t.workdayEngine.summary.notStarted}</div>
        <div className="acWorkdaySummaryValue">{props.summary.notStartedCount}</div>
      </div>
      <div className="acWorkdaySummaryTile">
        <div className="acWorkdaySummaryLabel">{t.workdayEngine.summary.avgPhase}</div>
        <div className="acWorkdaySummaryValue">{props.summary.avgPhasesCompleted}</div>
      </div>
      <div className="acWorkdaySummaryTile">
        <div className="acWorkdaySummaryLabel">{t.workdayEngine.summary.reportsToday}</div>
        <div className="acWorkdaySummaryValue">{props.summary.reportsToday}</div>
      </div>
      <div className="acWorkdaySummaryTile">
        <div className="acWorkdaySummaryLabel">{t.workdayEngine.summary.tasksInProgress}</div>
        <div className="acWorkdaySummaryValue">{props.summary.tasksInProgress}</div>
      </div>
    </div>
  )
}
