import type { WorkdayEvent } from '../../domain/presence'
import { EmployeeActivityCard } from './EmployeeActivityCard'
import { useI18n } from '../../i18n'

export function WorkdayTimeline(props: { events: WorkdayEvent[]; emptyLabel?: string }) {
  const { t } = useI18n()

  if (props.events.length === 0) {
    return <p className="acMuted">{props.emptyLabel ?? t.presence.workday.empty}</p>
  }

  return (
    <div className="acPresenceWorkday">
      {props.events.map((event) => (
        <EmployeeActivityCard key={event.id} event={event} />
      ))}
    </div>
  )
}
