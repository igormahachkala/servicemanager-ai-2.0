import { Link } from 'react-router-dom'
import * as api from '../../lib/api'

type Props = {
  detail: api.MapLocationDetail | null | undefined
  isLoading?: boolean
}

function statusLabel(status: api.TicketStatus) {
  if (status === 'NEW') return 'Новая'
  if (status === 'IN_PROGRESS') return 'В работе'
  if (status === 'DONE') return 'Завершена'
  if (status === 'ASSIGNED') return 'Назначена'
  if (status === 'CANCELED') return 'Отменена'
  return status
}

function fmt(date: string) {
  return new Date(date).toLocaleString('ru-RU')
}

export function LocationSummaryCard({ detail, isLoading }: Props) {
  if (isLoading) {
    return <div className="panel">Загружаем сводку по точке…</div>
  }

  if (!detail) {
    return (
      <div className="panel">
        <h3 style={{ marginBottom: 10 }}>Сводка по точке</h3>
        <div className="muted">
          Выберите метку на карте, чтобы увидеть сводку по точке.
        </div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ display: 'grid', gap: 12 }}>
      <div>
        <h3 style={{ marginBottom: 6 }}>{detail.name}</h3>
        <div className="muted small">{detail.address || 'Адрес не указан'}</div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div className="row">
          <strong>Всего за сегодня</strong>
          <span>{detail.summary.total}</span>
        </div>
        <div className="row">
          <strong>Новые</strong>
          <span>{detail.summary.newCount}</span>
        </div>
        <div className="row">
          <strong>В работе</strong>
          <span>{detail.summary.inProgressCount}</span>
        </div>
        <div className="row">
          <strong>Выполнено</strong>
          <span>{detail.summary.doneCount}</span>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Последние заявки</div>

        {detail.recentTickets.length === 0 ? (
          <div className="muted small">По этой точке заявок пока нет.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {detail.recentTickets.map((ticket) => (
              <div key={ticket.id} className="ticket" style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontWeight: 600 }}>{ticket.title}</div>
                <div className="muted small">
                  {statusLabel(ticket.status)} · {fmt(ticket.createdAt)}
                </div>
                <div>
                  <Link to={`/tickets/${ticket.id}`}>
                    <button className="ghost">Открыть заявку</button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
