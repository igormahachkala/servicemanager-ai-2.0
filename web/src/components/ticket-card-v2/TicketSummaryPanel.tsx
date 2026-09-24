import type { ReactNode } from 'react'
import * as api from '../../lib/api'
import { identityLines, presentTicketAssignee, presentTicketCreator, type TicketIdentityPresentation } from '../../lib/ticketActorIdentity'
import { CategoryGuidancePanel } from '../CategoryGuidancePanel'

export type TicketSummaryPanelProps = {
  ticket: api.TicketGetOne | null
  shortProblemText: string
  showLifecycleHint: boolean
  statusNode: ReactNode
}

function IdentitySummaryBlock({ title, identity, timestamp }: { title: string; identity: TicketIdentityPresentation; timestamp?: string | null }) {
  return (
    <div className="uiCard" style={{ padding: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{title}</div>
      <div className="muted small" style={{ display: 'grid', gap: 2 }}>
        {identityLines(identity).map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
        {timestamp ? <div>{new Date(timestamp).toLocaleString('ru-RU')}</div> : null}
      </div>
    </div>
  )
}

export function TicketSummaryPanel({ ticket, shortProblemText, showLifecycleHint, statusNode }: TicketSummaryPanelProps) {
  if (!ticket) return null

  const creator = presentTicketCreator(ticket)
  const assignee = presentTicketAssignee(ticket)

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
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <IdentitySummaryBlock title="Создал заявку" identity={creator} timestamp={ticket.createdAt} />
          <IdentitySummaryBlock title="Назначено" identity={assignee} />
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
