import type { CanvasLiveStatus } from '../../domain/canvas'
import { useI18n } from '../../i18n'

type Props = {
  status: CanvasLiveStatus
}

export function LiveIndicator({ status }: Props) {
  const { t } = useI18n()
  const label = t.canvasEngine.liveStatuses[status]

  return (
    <span className={`acCanvasLive acCanvasLive${capitalize(status)}`} aria-label={label}>
      {label}
    </span>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
