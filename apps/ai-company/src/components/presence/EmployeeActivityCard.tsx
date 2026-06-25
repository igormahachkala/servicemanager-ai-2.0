import type { WorkdayEvent } from '../../domain/presence'
import { resolveEmployeeLabel } from '../../domain/presence/employeeLabel'
import { useI18n } from '../../i18n'

export function EmployeeActivityCard(props: { event: WorkdayEvent }) {
  const { t } = useI18n()
  const { event } = props
  const label = resolveEmployeeLabel(event.employeeId)

  return (
    <div className="acPresenceActivityRow">
      <span className="acMono acMuted">{new Date(event.startedAt).toLocaleTimeString()}</span>
      <span className="acPresenceActivityName">{label.codename}</span>
      <span>{event.label}</span>
      <span className="acPresenceActivityType">{t.presence.workdayTypes[event.type]}</span>
    </div>
  )
}
