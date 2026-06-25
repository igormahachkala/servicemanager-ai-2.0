import type { EventDateGroup } from '../../domain/events/eventStorage'
import { TimelineCard } from './TimelineCard'

export function EventGroup({ group }: { group: EventDateGroup }) {
  return (
    <section className="mcEventGroup">
      <header className="mcEventGroupHead">
        <h3 className="mcEventGroupTitle">{group.dateLabel}</h3>
        <span className="mcMono mcMuted">{group.events.length}</span>
      </header>
      <div className="mcEventGroupList">
        {group.events.map((event) => (
          <TimelineCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  )
}
