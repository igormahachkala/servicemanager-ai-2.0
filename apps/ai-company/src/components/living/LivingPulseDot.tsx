import type { LivingPhase } from '../../domain/living'

type Props = {
  phase: LivingPhase
  size?: 'sm' | 'md'
  className?: string
}

export function LivingPulseDot({ phase, size = 'md', className = '' }: Props) {
  const sizeClass = size === 'sm' ? ' acLivingPulseSm' : ''
  const phaseClass = phase === 'idle' ? ' acLivingPulseIdle' : ` acLivingPulse${capitalize(phase)}`

  return (
    <span
      className={`acLivingPulse${sizeClass}${phaseClass}${className ? ` ${className}` : ''}`}
      aria-hidden
    />
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
