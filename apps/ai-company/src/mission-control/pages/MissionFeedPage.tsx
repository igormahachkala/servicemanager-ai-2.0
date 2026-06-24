import { useMemo, useState } from 'react'
import { PageHeader, Panel, StatusDot, feedDot, formatFeedTime } from '../components/ui'
import { feedEvents } from '../data/mock'
import type { FeedSeverity } from '../data/types'

type SeverityFilter = 'all' | FeedSeverity

const SEV: Array<{ id: SeverityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'info', label: 'info' },
  { id: 'success', label: 'success' },
  { id: 'warn', label: 'warn' },
  { id: 'error', label: 'error' },
]

export function MissionFeedPage() {
  const [filter, setFilter] = useState<SeverityFilter>('all')

  const events = useMemo(() => {
    if (filter === 'all') return feedEvents
    return feedEvents.filter((e) => e.severity === filter)
  }, [filter])

  return (
    <>
      <PageHeader
        title="Mission Feed"
        description="NOC event stream — agent actions, task transitions, tool health, system alerts."
      />

      <div className="mcChipRow">
        {SEV.map((s) => (
          <button
            key={s.id}
            type="button"
            className={filter === s.id ? 'mcChip mcChipActive' : 'mcChip'}
            onClick={() => setFilter(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Panel title="Live feed" right={<span className="mcMono mcMuted">{events.length} events</span>}>
        <ul className="mcFeedList">
          {events.map((e) => (
            <li key={e.id} className="mcFeedItem">
              <StatusDot kind={feedDot(e.severity)} />
              <span className="mcFeedTime">{formatFeedTime(e.at)}</span>
              <div className="mcFeedBody">
                <p className="mcFeedMsg">{e.message}</p>
                <div className="mcFeedMeta">
                  {e.type} · {e.source}
                  {e.taskId ? ` · ${e.taskId}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
