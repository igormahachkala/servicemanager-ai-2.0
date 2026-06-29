import type { LivingActivitySnapshot } from '../../domain/living'
import { useLivingActivityFormat } from '../../hooks/useLivingActivityFormat'
import { LivingProgressBar } from './LivingProgressBar'
import { LivingPulseDot } from './LivingPulseDot'

type Props = {
  snapshot: LivingActivitySnapshot
  showPhase?: boolean
  showProgress?: boolean
  showSince?: boolean
  compact?: boolean
  className?: string
}

export function LivingActivityLine({
  snapshot,
  showPhase = false,
  showProgress = true,
  showSince = true,
  compact = false,
  className = '',
}: Props) {
  const { formatActivity, formatSince, phaseLabel } = useLivingActivityFormat()
  const label = formatActivity(snapshot)
  const since = showSince ? formatSince(snapshot.since) : null
  const completed = snapshot.phase === 'completed'

  return (
    <div
      className={`acLivingActivity${compact ? ' acLivingActivityCompact' : ''}${completed ? ' acLivingActivityCompleted' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="acLivingActivityHead">
        <LivingPulseDot phase={snapshot.phase} size={compact ? 'sm' : 'md'} />
        <span className="acLivingActivityText">{label}</span>
        {showPhase ? (
          <span className="acLivingActivityPhase acMuted">{phaseLabel(snapshot.phase)}</span>
        ) : null}
        {since ? <span className="acLivingActivitySince acMuted">{since}</span> : null}
      </div>
      {showProgress ? (
        <LivingProgressBar value={snapshot.progress} phase={snapshot.phase} compact={compact} />
      ) : null}
    </div>
  )
}
