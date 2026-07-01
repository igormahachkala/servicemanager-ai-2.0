import { Link } from 'react-router-dom'
import type { EmployeeTimelineEntry } from '../../domain/employeeTimeline'
import { useI18n } from '../../i18n'

type Props = {
  entry: EmployeeTimelineEntry
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EmployeeTimelineItem({ entry }: Props) {
  const { t } = useI18n()

  return (
    <article className="acEmployeeTimelineItem">
      <div className="acEmployeeTimelineCell acEmployeeTimelineCellTime">
        <span className="mcMono">{formatTime(entry.createdAt)}</span>
      </div>
      <div className="acEmployeeTimelineCell acEmployeeTimelineCellEvent">
        <span className={`acEmployeeTimelineKind acEmployeeTimelineKind${capitalizeKind(entry.kind)}`}>
          {t.employeeTimelineEngine.kinds[entry.kind]}
        </span>
        {entry.severity ? (
          <span
            className={`acEmployeeTimelineSeverityBadge acEmployeeTimelineSeverity${capitalize(entry.severity)}`}
          >
            {t.feedSeverity[entry.severity]}
          </span>
        ) : null}
      </div>
      <div className="acEmployeeTimelineCell acEmployeeTimelineCellProject">
        {entry.projectId ? (
          <Link to={`/ops/projects/${encodeURIComponent(entry.projectId)}`} className="acLink">
            {entry.projectLabel ?? entry.projectId}
          </Link>
        ) : (
          <span className="mcMuted">{entry.projectLabel ?? t.common.empty}</span>
        )}
      </div>
      <div className="acEmployeeTimelineCell acEmployeeTimelineCellDescription">
        <p className="acEmployeeTimelineDescription">{entry.description}</p>
        {entry.href ? (
          <Link to={entry.href} className="acEmployeeTimelineOpenLink">
            {t.employeeTimelineEngine.openSource}
          </Link>
        ) : null}
      </div>
    </article>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function capitalizeKind(kind: EmployeeTimelineEntry['kind']): string {
  return kind
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
