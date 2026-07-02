import type { EventDateGroup } from '../../domain/events/eventStorage'
import { ContextEmptyState } from '../empty-states'
import { EventGroup } from './EventGroup'

export function Timeline({
  groups,
  variant = 'initial',
}: {
  groups: EventDateGroup[]
  variant?: 'initial' | 'filtered'
}) {
  if (groups.length === 0) {
    return <ContextEmptyState area="timeline" variant={variant} compact />
  }

  return (
    <div className="mcEventTimeline">
      {groups.map((group) => (
        <EventGroup key={group.dateKey} group={group} />
      ))}
    </div>
  )
}
