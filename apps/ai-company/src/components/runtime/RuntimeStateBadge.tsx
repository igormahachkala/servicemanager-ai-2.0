import type { RuntimeRunState } from '../../domain/runtime/runtimeState'
import { useI18n } from '../../i18n'

type RuntimeStateBadgeProps = {
  state: RuntimeRunState
  compact?: boolean
}

export function RuntimeStateBadge({ state, compact = false }: RuntimeStateBadgeProps) {
  const { t } = useI18n()

  return (
    <span
      className={`mcRuntimeRunStateBadge mcRuntimeRunState${capitalize(state)}${compact ? ' mcRuntimeRunStateBadgeCompact' : ''}`}
    >
      {t.runtimeOrchestrator.states[state]}
    </span>
  )
}

function capitalize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
