import type { CompanyEvent } from '../../domain/events/eventStorage'
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

export function TimelineCard({ event }: { event: CompanyEvent }) {
  const { t } = useI18n()
  const employee = event.employeeId ? resolveEmployee(event.employeeId) : null
  const workspace = event.workspaceId ? getWorkspaceById(event.workspaceId) : null
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
        </div>
        {Object.keys(event.metadata).length > 0 ? (
          <pre className="mcEventMetadata">{JSON.stringify(event.metadata, null, 2)}</pre>
        ) : null}
      </div>
    </article>
  )
}
