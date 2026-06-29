import { Badge, type BadgeVariant } from '../layout'
import type { ToolExecution } from '../../domain/toolExecution'
import { useI18n } from '../../i18n'
import { toolExecutionStatusLabel } from '../../i18n/uiLabels'

function statusVariant(status: ToolExecution['status']): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    case 'waiting_approval':
      return 'warning'
    case 'running':
      return 'info'
    case 'approved':
      return 'accent'
    default:
      return 'default'
  }
}

function statusClass(status: ToolExecution['status']): string {
  switch (status) {
    case 'created':
      return 'acToolStatusBadgeCreated'
    case 'waiting_approval':
      return 'acToolStatusBadgeWaitingApproval'
    case 'approved':
      return 'acToolStatusBadgeApproved'
    case 'running':
      return 'acToolStatusBadgeRunning'
    case 'completed':
      return 'acToolStatusBadgeCompleted'
    case 'failed':
      return 'acToolStatusBadgeFailed'
    case 'cancelled':
      return 'acToolStatusBadgeCancelled'
    default:
      return 'acToolStatusBadgeCreated'
  }
}

export function ToolRequestCard(props: {
  execution: ToolExecution
  compact?: boolean
  selected?: boolean
  onSelect?: (executionId: string) => void
}) {
  const { t } = useI18n()
  const { execution } = props

  return (
    <article
      className={`acToolRequestCard ${props.compact ? 'acToolRequestCardCompact' : ''}`}
      style={{
        padding: 10,
        borderRadius: 10,
        border: props.selected ? '1px solid var(--ac-accent)' : '1px solid var(--ac-border)',
        background: 'var(--ac-surface-1)',
      }}
    >
      <div className="acToolRequestCardHeader">
        <div>
          <div className="acToolRequestCardTitle">{execution.request.toolId}</div>
          <div className="acToolRequestCardMeta">
            <span>{execution.request.employeeId}</span>
            <span>{execution.request.provider}</span>
            <span>{execution.request.action}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {execution.request.provider === 'mock' ? (
            <span className="acToolMockTag">{t.toolExecutionEngine.card.mockTag}</span>
          ) : null}
          <Badge variant={statusVariant(execution.status)}>
            {toolExecutionStatusLabel(t, execution.status)}
          </Badge>
          <span className={`acToolStatusBadge ${statusClass(execution.status)}`}>
            {toolExecutionStatusLabel(t, execution.status)}
          </span>
        </div>
      </div>

      <pre className="acToolRequestArgs">{JSON.stringify(execution.request.arguments, null, 2)}</pre>

      {props.onSelect ? (
        <button className="mcBtn mcBtnSecondary" type="button" onClick={() => props.onSelect?.(execution.id)}>
          {props.selected ? t.toolExecutionEngine.card.selected : t.toolExecutionEngine.card.openDetails}
        </button>
      ) : null}
    </article>
  )
}
