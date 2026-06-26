import { Link } from 'react-router-dom'
import type { CompanyEvent } from '../../domain/events/event'
import { Badge, Card } from '../layout'
import { formatFeedTime } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  events: CompanyEvent[]
}

export function LiveTimelinePanel({ events }: Props) {
  const { t } = useI18n()

  const eventLabel = (metadata: CompanyEvent['metadata']) => {
    if (typeof metadata.message === 'string') return metadata.message
    if (typeof metadata.preview === 'string') return metadata.preview
    if (typeof metadata.title === 'string') return metadata.title
    if (typeof metadata.subject === 'string') return metadata.subject
    return t.executiveDashboard.eventFallback
  }

  return (
    <Card
      title={t.commandCenter.sections.liveTimeline}
      action={<Link to="/ops/timeline" className="acLink">{t.executiveDashboard.viewAll}</Link>}
    >
      {events.length === 0 ? (
        <div className="acMuted">{t.executiveDashboard.noData}</div>
      ) : (
        <div className="mcCommandCenterTimeline">
          {events.map((event) => (
            <div key={event.id} className="mcCommandCenterTimelineRow">
              <span className="acMono acMuted">{formatFeedTime(event.createdAt)}</span>
              <span>{eventLabel(event.metadata)}</span>
              <Badge variant={event.severity === 'error' ? 'danger' : 'default'}>{event.type}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
