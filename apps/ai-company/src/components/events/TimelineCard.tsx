import { Link } from 'react-router-dom'
import type { CompanyEvent } from '../../domain/events/eventStorage'
import { getRunHistoryByRuntimeRunId } from '../../domain/run/runStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { getWorkspaceById } from '../../domain/workspaces/workspace'
import { useI18n } from '../../i18n'
import { EventBadge } from './EventBadge'

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resolveRunLink(event: CompanyEvent): string | null {
  if (event.sourceType !== 'run' && event.sourceType !== 'runtime') return null
  const history = getRunHistoryByRuntimeRunId(event.sourceId)
  if (history) return `/ops/runs/${history.id}`
  if (event.sourceId.startsWith('run-hist-')) return `/ops/runs/${event.sourceId}`
  return null
}

export function TimelineCard({ event }: { event: CompanyEvent }) {
  const { t } = useI18n()
  const employee = event.employeeId ? resolveEmployee(event.employeeId) : null
  const workspace = event.workspaceId ? getWorkspaceById(event.workspaceId) : null
  const runLink = resolveRunLink(event)
  const message =
    typeof event.metadata.message === 'string'
      ? event.metadata.message
      : typeof event.metadata.preview === 'string'
        ? event.metadata.preview
        : typeof event.metadata.title === 'string'
          ? event.metadata.title
          : typeof event.metadata.subject === 'string'
            ? event.metadata.subject
            : null

  return (
    <article className="mcEventCard">
      <div className="mcEventCardHead">
        <EventBadge kind="type" value={event.type} />
        <EventBadge kind="severity" value={event.severity} />
        <span className="mcEventTime mcMono mcMuted">{formatEventTime(event.createdAt)}</span>
      </div>

      <div className="mcEventCardBody">
        {message ? <p className="mcEventMessage">{message}</p> : null}
        <div className="mcEventMeta">
          <span className="mcMono">
            {t.eventEngine.sourceLabel}: {event.sourceType}/{event.sourceId}
          </span>
          {employee ? (
            <span>
              {t.eventEngine.employeeLabel}: {employee.codename}
            </span>
          ) : null}
          {workspace ? (
            <span>
              {t.eventEngine.workspaceLabel}: {workspace.name}
            </span>
          ) : null}
          {event.reportId ? (
            <span className="mcMono">
              {t.eventEngine.reportLabel}: {event.reportId}
            </span>
          ) : null}
          {runLink ? (
            <Link to={runLink} className="mcBtn mcBtnSecondary mcBtnSmall">
              {t.runEngine.openRun}
            </Link>
          ) : null}
        </div>
        {Object.keys(event.metadata).length > 0 ? (
          <pre className="mcEventMetadata">{JSON.stringify(event.metadata, null, 2)}</pre>
        ) : null}
      </div>
    </article>
  )
}
