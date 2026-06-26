import type { CanvasLiveStatus } from '../../domain/canvas'
import { useI18n } from '../../i18n'

type Props = {
  status: CanvasLiveStatus
  compact?: boolean
}

export function LiveIndicator({ status, compact = false }: Props) {
  const { t } = useI18n()
  const label = t.canvasEngine.liveStatuses[status]

  return (
    <span
      className={`acCanvasLive acCanvasLive${capitalize(status)}${compact ? ' acCanvasLiveCompact' : ''}`}
      aria-label={label}
    >
      {compact ? null : label}
    </span>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
