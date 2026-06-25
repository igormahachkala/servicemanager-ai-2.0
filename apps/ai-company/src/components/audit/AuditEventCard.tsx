import type { AuditEvent } from '../../domain/audit/auditEvent'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

export function AuditEventCard({ event }: { event: AuditEvent }) {
  const { t } = useI18n()

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
