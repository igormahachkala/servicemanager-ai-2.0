import type { PresenceStatus } from '../../domain/presence'
import { useI18n } from '../../i18n'

type EmployeeStatusBadgeProps = {
  status: PresenceStatus
  compact?: boolean
}

export function EmployeeStatusBadge({ status, compact = false }: EmployeeStatusBadgeProps) {
  const { t } = useI18n()

  return (
    <span
      className={`acPresenceBadge acPresenceBadge${capitalize(status)}${compact ? ' acPresenceBadgeCompact' : ''}`}
    >
      {t.presence.status[status]}
    </span>
  )
}

function capitalize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
