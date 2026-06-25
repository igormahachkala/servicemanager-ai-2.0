import type { EventSeverity, EventType } from '../../domain/events/eventStorage'
import { isFutureEventType } from '../../domain/events/eventStorage'
import { useI18n } from '../../i18n'

type EventBadgeProps = {
  kind: 'severity' | 'type'
  value: EventSeverity | EventType
}

export function EventBadge({ kind, value }: EventBadgeProps) {
  const { t } = useI18n()

  if (kind === 'severity') {
    const severity = value as EventSeverity
    return (
      <span className={`mcEventBadge mcEventBadgeSeverity mcEventSeverity${capitalize(severity)}`}>
        {t.feedSeverity[severity]}
      </span>
    )
  }

  const type = value as EventType
  const future = isFutureEventType(type)

  return (
    <span className={`mcEventBadge mcEventBadgeType${future ? ' mcEventBadgeFuture' : ''}`}>
      {t.eventEngine.types[type]}
      {future ? ` · ${t.eventEngine.futureBadge}` : ''}
    </span>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
