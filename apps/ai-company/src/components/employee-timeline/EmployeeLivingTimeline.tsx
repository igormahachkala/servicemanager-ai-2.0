import type { EmployeeTimelinePeriod } from '../../domain/employeeTimeline'
import { useEmployeeTimeline } from '../../hooks/useEmployeeTimeline'
import { useI18n } from '../../i18n'
import { EmployeeTimelineItem } from './EmployeeTimelineItem'

type Props = {
  employeeId: string
  compact?: boolean
}

const PERIODS: EmployeeTimelinePeriod[] = ['today', 'week', 'all']

export function EmployeeLivingTimeline({ employeeId, compact = false }: Props) {
  const { t } = useI18n()
  const { entries, summary, period, setPeriod } = useEmployeeTimeline(employeeId)
  const et = t.employeeTimelineEngine

  return (
    <section className={`acEmployeeTimeline${compact ? ' acEmployeeTimelineCompact' : ''}`}>
      <div className="acEmployeeTimelineHead">
        <div>
          <h2 className="acEmployeeTimelineTitle">{et.title}</h2>
          <p className="acEmployeeTimelineDescription">{et.description}</p>
        </div>
        <div className="acEmployeeTimelineFilters" role="tablist" aria-label={et.filtersLabel}>
          {PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={period === item}
              className={`acEmployeeTimelineFilter${period === item ? ' acEmployeeTimelineFilterActive' : ''}`}
              onClick={() => setPeriod(item)}
            >
              {et.filters[item]}
            </button>
          ))}
        </div>
      </div>

      {!compact ? (
        <div className="acEmployeeTimelineSummary">
          <div className="acEmployeeTimelineSummaryItem">
            <span className="acEmployeeTimelineSummaryValue">{summary.runtimeCompleted}</span>
            <span className="acEmployeeTimelineSummaryLabel">{et.summary.runtimeCompleted}</span>
          </div>
          <div className="acEmployeeTimelineSummaryItem">
            <span className="acEmployeeTimelineSummaryValue">{summary.tasksApproved}</span>
            <span className="acEmployeeTimelineSummaryLabel">{et.summary.tasksApproved}</span>
          </div>
          <div className="acEmployeeTimelineSummaryItem">
            <span className="acEmployeeTimelineSummaryValue">{summary.knowledgeLearned}</span>
            <span className="acEmployeeTimelineSummaryLabel">{et.summary.knowledgeLearned}</span>
          </div>
          <div className="acEmployeeTimelineSummaryItem">
            <span className="acEmployeeTimelineSummaryValue">{summary.memoryEvolved}</span>
            <span className="acEmployeeTimelineSummaryLabel">{et.summary.memoryEvolved}</span>
          </div>
        </div>
      ) : null}

      <div className="acEmployeeTimelineTable" role="table" aria-label={et.title}>
        <div className="acEmployeeTimelineHeader" role="row">
          <span role="columnheader">{et.columns.time}</span>
          <span role="columnheader">{et.columns.event}</span>
          <span role="columnheader">{et.columns.project}</span>
          <span role="columnheader">{et.columns.description}</span>
        </div>

        {entries.length === 0 ? (
          <p className="mcMuted acEmployeeTimelineEmpty">{et.empty}</p>
        ) : (
          <div className="acEmployeeTimelineList">
            {entries.slice(0, compact ? 6 : undefined).map((entry) => (
              <EmployeeTimelineItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
