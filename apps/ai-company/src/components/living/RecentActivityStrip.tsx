import type { CompanyEvent } from '../../domain/events/event'
import { formatLivingRelativeTime } from '../../domain/living'
import { formatFeedTime } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'
import { LivingPulseDot } from './LivingPulseDot'

type Props = {
  events: CompanyEvent[]
  limit?: number
  compact?: boolean
}

function eventLabel(event: CompanyEvent, fallback: string): string {
  const { metadata } = event
  if (typeof metadata.message === 'string') return metadata.message
  if (typeof metadata.preview === 'string') return metadata.preview
  if (typeof metadata.title === 'string') return metadata.title
  if (typeof metadata.subject === 'string') return metadata.subject
  return fallback
}

function isRecent(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000
}

export function RecentActivityStrip({ events, limit = 5, compact = false }: Props) {
  const { t } = useI18n()
  const items = events.slice(0, limit)

  if (items.length === 0) {
    return <p className="acMuted acLivingRecentEmpty">{t.livingCompany.noRecentActivity}</p>
  }

  return (
    <ul className={`acLivingRecentList${compact ? ' acLivingRecentListCompact' : ''}`}>
      {items.map((event) => {
        const recent = isRecent(event.createdAt)
        const relative = formatLivingRelativeTime(event.createdAt)
        const timeLabel =
          relative === 'now'
            ? t.livingCompany.now
            : relative
              ? t.livingCompany.since.replace('{time}', relative)
              : formatFeedTime(event.createdAt)

        return (
          <li key={event.id} className="acLivingRecentItem">
            {recent ? <LivingPulseDot phase="working" size="sm" /> : <span className="acLivingRecentDot" />}
            <span className="acLivingRecentText">{eventLabel(event, t.executiveDashboard.eventFallback)}</span>
            <span className="acLivingRecentTime acMuted">{timeLabel}</span>
          </li>
        )
      })}
    </ul>
  )
}
