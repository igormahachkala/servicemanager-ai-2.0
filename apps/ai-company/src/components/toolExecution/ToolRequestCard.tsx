import { Badge, type BadgeVariant } from '../layout'
import type { ToolExecution } from '../../domain/toolExecution'

function statusLabel(status: ToolExecution['status']): string {
  switch (status) {
    case 'created':
      return 'Created'
    case 'waiting_approval':
      return 'Waiting approval'
    case 'approved':
      return 'Approved'
    case 'running':
      return 'Running'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

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
          {execution.request.provider === 'mock' ? <span className="acToolMockTag">mock</span> : null}
          <Badge variant={statusVariant(execution.status)}>{statusLabel(execution.status)}</Badge>
          <span className={`acToolStatusBadge ${statusClass(execution.status)}`}>{execution.status}</span>
        </div>
      </div>

      <pre className="acToolRequestArgs">{JSON.stringify(execution.request.arguments, null, 2)}</pre>

      {props.onSelect ? (
        <button className="mcBtn mcBtnSecondary" type="button" onClick={() => props.onSelect?.(execution.id)}>
          {props.selected ? 'Selected' : 'Open details'}
        </button>
      ) : null}
    </article>
  )
}
