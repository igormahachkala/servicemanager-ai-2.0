import type { AuditEvent } from '../../domain/audit/auditEvent'
import { AuditEventCard } from './AuditEventCard'
import { useI18n } from '../../i18n'

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  const { t } = useI18n()

  if (events.length === 0) {
    return (
      <div className="mcAuditEmpty">
        <div className="mcAuditEmptyTitle">{t.audit.emptyTitle}</div>
        <p className="mcAuditEmptyDesc">{t.audit.emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="mcAuditTimeline">
      {events.map((event) => (
        <AuditEventCard key={event.id} event={event} />
      ))}
    </div>
  )
}
