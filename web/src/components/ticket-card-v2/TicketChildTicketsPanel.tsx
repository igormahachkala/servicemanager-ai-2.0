import type { ReactNode } from 'react'
import type * as api from '../../lib/api'

type Props = {
  childTickets: NonNullable<api.TicketGetOne['children']>
  fmt: (dt?: string | null) => string
  getChildHref: (childId: string) => string
  renderStatusPill: (status: api.TicketStatus) => ReactNode
}

export function TicketChildTicketsPanel({ childTickets, fmt, getChildHref, renderStatusPill }: Props) {
  return (
    <div className="panel uiCard" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Дополнительные работы</h3>
      {childTickets.length === 0 ? (
        <div className="muted small">Дополнительных работ пока нет.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {childTickets.map((child) => (
            <div key={child.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <div className="row" style={{ marginBottom: 6, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{child.problemText || 'Доп. работа'}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {child.problemCategory?.name || 'Без категории'} · {fmt(child.createdAt)}
                  </div>
                </div>
                {renderStatusPill(child.status)}
              </div>
              <div className="muted small" style={{ marginBottom: 8 }}>
                {[child.location?.name, child.location?.city, child.location?.address].filter(Boolean).join(' · ') || 'Локация не указана'}
              </div>
              <a href={getChildHref(child.id)} style={{ textDecoration: 'none' }}>
                <button className="ghost">Открыть заявку</button>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
