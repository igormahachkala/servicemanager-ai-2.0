import type { HandoffTarget } from '../../domain/handoff'
import { HANDOFF_TARGET_LABELS } from '../../domain/handoff'
import { useI18n } from '../../i18n'

export function HandoffTargetBadge({
  target,
  compact = false,
}: {
  target: HandoffTarget
  compact?: boolean
}) {
  const { t } = useI18n()
  const label = t.handoffEngine.targets[target] ?? HANDOFF_TARGET_LABELS[target]

  return (
    <span className={`acHandoffTargetBadge acHandoffTargetBadge${capitalize(target)}${compact ? ' acHandoffTargetBadgeCompact' : ''}`}>
      {label}
    </span>
  )
}

function capitalize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
