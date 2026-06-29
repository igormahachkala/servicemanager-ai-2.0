import * as api from '../../lib/api'

type TicketStatusActionsProps = {
  ticket?: api.TicketGetOne
  canChangeStatus: boolean
  statusPending: boolean
  canTransitionTo: (status: api.TicketStatus) => boolean
  onChangeStatus: (status: api.TicketStatus) => void
  statusError?: string | null
}

export function TicketStatusActions(props: TicketStatusActionsProps) {
  const { ticket, canChangeStatus, statusPending, canTransitionTo, onChangeStatus, statusError } = props

  if (!ticket || !canChangeStatus) return null

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Действия по заявке</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="ghost" disabled={statusPending || !canTransitionTo('IN_PROGRESS')} onClick={() => onChangeStatus('IN_PROGRESS')}>
          {statusPending ? 'Сохраняем…' : 'Начать работу'}
        </button>
        <button className="ghost" disabled={statusPending || !canTransitionTo('AWAITING_ACCEPTANCE')} onClick={() => onChangeStatus('AWAITING_ACCEPTANCE')}>
          {statusPending ? 'Сохраняем…' : 'Отправить на приёмку'}
        </button>
        <button className="ghost" disabled={statusPending || !canTransitionTo('CANCELED')} onClick={() => onChangeStatus('CANCELED')}>
          {statusPending ? 'Сохраняем…' : 'Отменить'}
        </button>
      </div>
      {statusError ? <div className="alert" style={{ marginTop: 10 }}>{statusError}</div> : null}
    </div>
  )
}
