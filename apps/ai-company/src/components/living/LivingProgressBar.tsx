type Props = {
  value: number | null
  phase?: 'working' | 'thinking' | 'waiting' | 'reviewing' | 'completed' | 'idle'
  compact?: boolean
}

export function LivingProgressBar({ value, phase = 'working', compact = false }: Props) {
  if (value === null) return null
  const clamped = Math.max(0, Math.min(100, value))
  const phaseClass = phase === 'idle' ? '' : ` acLivingProgress${capitalize(phase)}`

  return (
    <div
      className={`acLivingProgress${compact ? ' acLivingProgressCompact' : ''}${phaseClass}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="acLivingProgressFill" style={{ width: `${clamped}%` }} />
      {!compact ? <span className="acLivingProgressLabel">{clamped}%</span> : null}
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
