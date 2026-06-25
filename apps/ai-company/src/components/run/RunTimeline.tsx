import type { RunTimelineEntry } from '../../domain/run/runStorage'
import { useI18n } from '../../i18n'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function RunTimeline({ entries }: { entries: RunTimelineEntry[] }) {
  const { t } = useI18n()

  if (entries.length === 0) {
    return <p className="mcMuted">{t.common.empty}</p>
  }

  return (
    <div className="mcRunTimeline">
      {entries.map((entry) => (
        <article key={entry.id} className="mcRunTimelineItem">
          <div className="mcRunTimelineDot" data-kind={entry.kind} aria-hidden />
          <div className="mcRunTimelineBody">
            <div className="mcRunTimelineHead">
              <span className="mcRunTimelineKind mcMono">{t.runEngine.timelineKinds[entry.kind]}</span>
              <span className="mcRunTimelineTime mcMono mcMuted">{formatTime(entry.timestamp)}</span>
            </div>
            <div className="mcRunTimelineLabel">{entry.label}</div>
            {entry.detail ? <div className="mcRunTimelineDetail mcMuted">{entry.detail}</div> : null}
          </div>
        </article>
      ))}
    </div>
  )
}
