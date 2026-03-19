import { Link } from 'react-router-dom'
import * as api from '../../lib/api'

type Props = {
  detail: api.MapLocationDetail | null | undefined
  isLoading?: boolean
}

function statusLabel(status: api.TicketStatus) {
  if (status === 'NEW') return 'New'
  if (status === 'IN_PROGRESS') return 'In progress'
  if (status === 'DONE') return 'Done'
  if (status === 'ASSIGNED') return 'Assigned'
  if (status === 'CANCELED') return 'Canceled'
  return status
}

function fmt(date: string) {
  return new Date(date).toLocaleString('ru-RU')
}

export function LocationSummaryCard({ detail, isLoading }: Props) {
  if (isLoading) {
    return <div className="panel">Loading location summary...</div>
  }

  if (!detail) {
    return (
      <div className="panel">
        <h3 style={{ marginBottom: 10 }}>Location details</h3>
        <div className="muted">
          Click a marker to see the operational summary for this location.
        </div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ display: 'grid', gap: 12 }}>
      <div>
        <h3 style={{ marginBottom: 6 }}>{detail.name}</h3>
        <div className="muted small">{detail.address || 'Address not specified'}</div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div className="row">
          <strong>Total today</strong>
          <span>{detail.summary.total}</span>
        </div>
        <div className="row">
          <strong>New</strong>
          <span>{detail.summary.newCount}</span>
        </div>
        <div className="row">
          <strong>In progress</strong>
          <span>{detail.summary.inProgressCount}</span>
        </div>
        <div className="row">
          <strong>Done</strong>
          <span>{detail.summary.doneCount}</span>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent tickets</div>

        {detail.recentTickets.length === 0 ? (
          <div className="muted small">No tickets for this location yet.</div>
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
                    <button className="ghost">Open ticket</button>
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
