import { Link } from 'react-router-dom'
import type { AuditEvent } from '../../domain/audit/auditEvent'
import { getRunHistoryById, getRunHistoryByRuntimeRunId } from '../../domain/run/runStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

function resolveRunLink(event: AuditEvent): string | null {
  if (event.targetType !== 'run') return null
  const byId = getRunHistoryById(event.targetId)
  if (byId) return `/ops/runs/${byId.id}`
  const byRuntime = getRunHistoryByRuntimeRunId(event.targetId)
  if (byRuntime) return `/ops/runs/${byRuntime.id}`
  return null
}

export function AuditEventCard({ event }: { event: AuditEvent }) {
  const { t } = useI18n()
  const runLink = resolveRunLink(event)

  const actorLabel =
    event.actorType === 'owner'
      ? t.audit.actors.owner
      : event.actorType === 'system'
        ? t.audit.actors.system
        : resolveEmployee(event.actorId)?.codename ?? event.actorId

  return (
    <article className="mcAuditEventCard">
      <div className="mcAuditEventHead">
        <span className={`mcAuditActor mcAuditActor${capitalize(event.actorType)}`}>
          {actorLabel}
        </span>
        <span className="mcAuditAction mcMono">{t.audit.actions[event.action]}</span>
        <span className="mcAuditTime mcMono mcMuted">
          {new Date(event.createdAt).toLocaleString()}
        </span>
      </div>
      <div className="mcAuditEventBody">
        <span className="mcAuditTarget mcMono">
          {t.audit.targetTypes[event.targetType]} · {event.targetId}
        </span>
        {runLink ? (
          <Link to={runLink} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.runEngine.openRun}
          </Link>
        ) : null}
        {Object.keys(event.metadata).length > 0 ? (
          <pre className="mcAuditMetadata">{JSON.stringify(event.metadata, null, 2)}</pre>
        ) : null}
      </div>
    </article>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
