import type { EventDateGroup } from '../../domain/events/eventStorage'
import { useI18n } from '../../i18n'
import { EventGroup } from './EventGroup'

export function Timeline({ groups }: { groups: EventDateGroup[] }) {
  const { t } = useI18n()

  if (groups.length === 0) {
    return (
      <div className="mcEventEmpty">
        <div className="mcEventEmptyTitle">{t.eventEngine.emptyTitle}</div>
        <p className="mcEventEmptyDesc">{t.eventEngine.emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="mcEventTimeline">
      {groups.map((group) => (
        <EventGroup key={group.dateKey} group={group} />
      ))}
    </div>
  )
}
