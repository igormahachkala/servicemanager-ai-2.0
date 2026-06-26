import type { CanvasLiveEvent } from '../../domain/canvas'
import { useI18n } from '../../i18n'

type Props = {
  events: CanvasLiveEvent[]
}

export function CanvasActivityTicker({ events }: Props) {
  const { t } = useI18n()
  if (events.length === 0) return null

  return (
    <div className="acCanvasTicker" aria-live="polite">
      <span className="acCanvasTickerLabel">{t.canvasEngine.liveFeed}</span>
      <div className="acCanvasTickerTrack">
        {events.slice(0, 5).map((event) => (
          <span key={event.id} className={`acCanvasTickerChip acCanvasTickerChip${capitalize(event.tone)}`}>
            {event.message}
          </span>
        ))}
      </div>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
