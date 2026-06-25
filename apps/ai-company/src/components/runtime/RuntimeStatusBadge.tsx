import type { RuntimeProfileStatus } from '../../domain/runtime/runtimeStorage'
import { useI18n } from '../../i18n'

type RuntimeStatusBadgeProps = {
  status: RuntimeProfileStatus
  compact?: boolean
}

export function RuntimeStatusBadge({ status, compact = false }: RuntimeStatusBadgeProps) {
  const { t } = useI18n()

  return (
    <span
      className={`mcRuntimeStatusBadge mcRuntimeStatus${capitalize(status)}${compact ? ' mcRuntimeStatusBadgeCompact' : ''}`}
    >
      {t.runtimeEngine.status[status]}
    </span>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
