import type { ExecutionStatus as ExecutionStatusValue } from '../../domain/execution'
import { useI18n } from '../../i18n'

type ExecutionStatusProps = {
  status: ExecutionStatusValue
  compact?: boolean
}

function statusClass(status: ExecutionStatusValue): string {
  if (status === 'completed') return 'mcExecStatusCompleted'
  if (status === 'failed') return 'mcExecStatusFailed'
  if (status === 'cancelled') return 'mcExecStatusCancelled'
  if (status === 'waiting_approval') return 'mcExecStatusWaiting'
  if (status === 'review') return 'mcExecStatusReview'
  if (status === 'running' || status === 'preparing') return 'mcExecStatusRunning'
  return 'mcExecStatusQueued'
}

export function ExecutionStatus({ status, compact = false }: ExecutionStatusProps) {
  const { t } = useI18n()

  return (
    <span
      className={`mcExecStatusBadge ${statusClass(status)}${compact ? ' mcExecStatusBadgeCompact' : ''}`}
    >
      {t.executionEngine.statuses[status]}
    </span>
  )
}
