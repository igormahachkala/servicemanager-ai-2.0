import { useMemo, useState } from 'react'
import { PageHeader, Panel, StatusDot, feedDot, formatFeedTime } from '../components/ui'
import { feedEvents } from '../data/mock'
import type { FeedSeverity } from '../data/types'
import { useI18n } from '../../i18n'

type SeverityFilter = 'all' | FeedSeverity

export function MissionFeedPage() {
  const { t } = useI18n()
  const [filter, setFilter] = useState<SeverityFilter>('all')

  const severityFilters: Array<{ id: SeverityFilter; label: string }> = [
    { id: 'all', label: t.common.all },
    { id: 'info', label: t.feedSeverity.info },
    { id: 'success', label: t.feedSeverity.success },
    { id: 'warn', label: t.feedSeverity.warn },
    { id: 'error', label: t.feedSeverity.error },
  ]

  const events = useMemo(() => {
    if (filter === 'all') return feedEvents
    return feedEvents.filter((event) => event.severity === filter)
  }, [filter])

  return (
    <>
      <PageHeader title={t.pages.missionFeed} description={t.feed.description} />

      <div className="mcChipRow">
        {severityFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? 'mcChip mcChipActive' : 'mcChip'}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Panel
        title={t.feed.liveFeed}
        right={
          <span className="mcMono mcMuted">
            {events.length} {t.feed.events}
          </span>
        }
      >
        <ul className="mcFeedList">
          {events.map((event) => (
            <li key={event.id} className="mcFeedItem">
              <StatusDot kind={feedDot(event.severity)} />
              <span className="mcFeedTime">{formatFeedTime(event.at)}</span>
              <div className="mcFeedBody">
                <p className="mcFeedMsg">{event.message}</p>
                <div className="mcFeedMeta">
                  {event.type} · {event.source}
                  {event.taskId ? ` · ${event.taskId}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
