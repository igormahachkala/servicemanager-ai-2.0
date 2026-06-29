import type { CanvasLiveStatus } from '../../domain/canvas'
import type { LivingPhase } from '../../domain/living'
import { LivingPulseDot } from '../living'
import { useI18n } from '../../i18n'

type Props = {
  status: CanvasLiveStatus
  compact?: boolean
}

function phaseFromCanvasStatus(status: CanvasLiveStatus): LivingPhase {
  if (status === 'thinking') return 'thinking'
  if (status === 'waiting') return 'waiting'
  if (status === 'review') return 'reviewing'
  if (status === 'running' || status === 'working') return 'working'
  return 'idle'
}

export function LiveIndicator({ status, compact = false }: Props) {
  const { t } = useI18n()
  const label = t.canvasEngine.liveStatuses[status]
  const phase = phaseFromCanvasStatus(status)

  return (
    <span
      className={`acCanvasLive acCanvasLive${capitalize(status)}${compact ? ' acCanvasLiveCompact' : ''}`}
      aria-label={label}
    >
      <LivingPulseDot phase={phase} size="sm" />
      {compact ? null : label}
    </span>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
