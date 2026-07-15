import type { ReactNode } from 'react'
import * as api from '../../lib/api'
import { CategoryGuidancePanel } from '../CategoryGuidancePanel'

export type TicketSummaryPanelProps = {
  ticket: api.TicketGetOne | null
  shortProblemText: string
  showLifecycleHint: boolean
  statusNode: ReactNode
}

export function TicketSummaryPanel({ ticket, shortProblemText, showLifecycleHint, statusNode }: TicketSummaryPanelProps) {
  if (!ticket) return null

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Кратко по заявке</h3>
      <div className="fieldHint" style={{ marginBottom: 8 }}>
        Срочность влияет на SLA-ожидания ответа (сроки на карточке и уведомления). Приоритет обычно задаётся при создании заявки.
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div><b>Категория:</b> {ticket.problemCategory?.name || '—'}</div>
        {showLifecycleHint && ticket.problemCategory?.name ? (
          <CategoryGuidancePanel categoryName={ticket.problemCategory.name} variant="desktop" />
        ) : null}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>Статус:</b> {statusNode}
        </div>
        <div>
          <b>Локация:</b>{' '}
          {ticket.location
            ? [ticket.location.name, ticket.location.city, ticket.location.address].filter(Boolean).join(' · ')
            : '—'}
        </div>
        <div><b>Описание:</b> {shortProblemText || '—'}</div>
        <div className="muted small"><b>Создана:</b> {new Date(ticket.createdAt).toLocaleString('ru-RU')}</div>
      </div>
    </div>
  )
}
