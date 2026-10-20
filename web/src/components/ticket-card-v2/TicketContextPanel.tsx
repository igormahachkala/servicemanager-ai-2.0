import * as api from '../../lib/api'

export type TicketContextPanelProps = {
  ticket: api.TicketGetOne | null
}

export function TicketContextPanel({ ticket }: TicketContextPanelProps) {
  if (!ticket) return null

  return (
    <div className="panel uiCard" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Дополнительно</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        <details open>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Детали</summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <div><b>Категория:</b> {ticket.problemCategory?.name || '—'}</div>
            <div><b>Срочность:</b> {ticket.urgency === 'URGENT' ? 'Срочно' : 'Не срочно'}</div>
            <div><b>SLA статус:</b> {ticket.slaBreachedAt ? 'Нарушен' : ticket.slaDueAt ? 'В норме' : 'Не задан'}</div>
            <div>
              <b>Описание проблемы:</b>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{ticket.problemText || '—'}</div>
            </div>
          </div>
        </details>

        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Заявитель / контакт</summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <div><b>Заявитель:</b> {ticket.requesterName || '—'}</div>
            <div><b>Телефон:</b> {ticket.requesterPhone || '—'}</div>
            <div><b>Точка:</b> {ticket.pointName || '—'}</div>
            <div><b>Адрес:</b> {ticket.address || '—'}</div>
          </div>
        </details>

        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Оборудование / локация</summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <div>
              <b>Локация:</b>{' '}
              {ticket.location
                ? [ticket.location.name, ticket.location.city, ticket.location.address].filter(Boolean).join(' · ')
                : '—'}
            </div>
            <div>
              <b>Оборудование / Asset:</b>{' '}
              {ticket.equipment
                ? [ticket.equipment.name, ticket.equipment.type, ticket.equipment.status].filter(Boolean).join(' · ')
                : '—'}
            </div>
          </div>
        </details>

        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Extra info</summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {ticket.location?.platformCode || ticket.location?.externalCode ? (
              <div className="muted small">
                {ticket.location?.platformCode ? `platformCode: ${ticket.location.platformCode}` : ''}
                {ticket.location?.platformCode && ticket.location?.externalCode ? ' · ' : ''}
                {ticket.location?.externalCode ? `externalCode: ${ticket.location.externalCode}` : ''}
              </div>
            ) : (
              <div className="muted small">Коды локации не заданы</div>
            )}
            <div><b>Назначен:</b> {ticket.assignedTechnician?.email || '—'}</div>
            <div><b>Создана:</b> {new Date(ticket.createdAt).toLocaleString('ru-RU')}</div>
          </div>
        </details>
      </div>
    </div>
  )
}
