import * as api from '../../lib/api'

export type TicketSlaPanelProps = {
  ticket: api.TicketGetOne | null
  slaState: {
    hasSla: boolean
    isBreached: boolean
    isAtRisk: boolean
  }
}

export function TicketSlaPanel({ ticket, slaState }: TicketSlaPanelProps) {
  if (!ticket) return null

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>SLA</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        <div>
          <b>Статус:</b>{' '}
          {slaState.isBreached ? 'Нарушен' : slaState.isAtRisk ? 'В риске' : ticket.slaDueAt ? 'В норме' : 'Не задан'}
        </div>
        <div><b>Срок:</b> {ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString('ru-RU') : '—'}</div>
        <div>
          <b>Пояснение:</b>{' '}
          {slaState.hasSla ? 'Срок контроля рассчитывается по правилам SLA.' : 'Для этой заявки SLA не задан.'}
        </div>
      </div>
    </div>
  )
}
