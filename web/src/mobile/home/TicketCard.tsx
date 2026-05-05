import { Link } from 'react-router-dom'
import * as api from '../../lib/api'
import {
  mobileTicketCategoryLocationFromCard,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  mobileTicketPriorityIsUrgent,
  mobileTicketSlaCountdownLabel,
  mobileTicketStatusLabelRu,
  type MobileTicketNavState,
} from '../mobileTicketDisplay'
import { MobileBoardClaimFallbackHint, MobileClaimReasonHintBox } from '../MobileUxHints'
import { assignedTechnicianDisplay, type HomePrimaryActionLabel } from './utils'

type Props = {
  ticket: api.TicketCard
  ticketHref: string
  linkState?: MobileTicketNavState
  actionLabel?: HomePrimaryActionLabel
  onAction?: (ticket: api.TicketCard) => void
  actionProgressLabel?: string | null
  assignFooter?: { onOpen: () => void; disabled: boolean } | null
}

export function TicketCard({
  ticket,
  ticketHref,
  linkState,
  actionLabel = null,
  onAction,
  actionProgressLabel = null,
  assignFooter = null,
}: Props) {
  const claimReason = (ticket.claimAvailabilityReason || '').trim()
  const actionBusy = !!actionProgressLabel
  const slaLine = mobileTicketSlaCountdownLabel({
    slaDueAt: ticket.slaDueAt,
    slaBreached: ticket.slaBreached,
    status: ticket.status,
  })
  const urgent = mobileTicketPriorityIsUrgent(ticket.priority ?? 'NORMAL')
  const overdue = ticket.slaBreached
  const problemPreview = (() => {
    const t = (ticket.description || '').trim()
    if (t) return t
    return (ticket.title || '').trim() || '—'
  })()
  const statusClass = `mobileTicketStatus mobileTicketStatus--${ticket.status}`
  const cardClass = ['mobileCard', 'mobileTicketCard', `mobileTicketCard--${ticket.status}`, overdue ? 'mobileTicketCardSlaOverdue' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cardClass} style={{ padding: 0, overflow: 'hidden' }}>
      <Link to={ticketHref} state={linkState ?? mobileTicketNavState('home')} className="mobileCardClickable" style={{ borderRadius: 0 }}>
        <div style={{ padding: 12 }}>
          <div className="mobileRow">
            <strong>{mobileTicketNumberTitle(ticket.ticketNumber)}</strong>
            <span className={statusClass}>{mobileTicketStatusLabelRu(ticket.status)}</span>
          </div>
          <div className="mobileTicketCardPriorityRow" style={{ marginTop: 6 }}>
            {urgent ? <span className="mobileSlaUrgentPill">Срочный приоритет</span> : <span className="mobileMeta">Приоритет: обычный</span>}
            {ticket.urgency === 'URGENT' && !urgent ? <span className="mobileSlaUrgentPill">Срочная заявка</span> : null}
          </div>
          {ticket.assignmentRequestedByCurrentUser ? (
            <div className="mobileAssignmentRequestedRow" style={{ marginTop: 8 }}>
              <span className="mobileAssignmentRequestedBadge">Запрос отправлен</span>
              <span className="mobileMeta mobileAssignmentRequestedRowHint">Ожидайте назначение диспетчером</span>
            </div>
          ) : null}
          <div className="mobileMeta" style={{ marginTop: 4 }}>{mobileTicketCategoryLocationFromCard(ticket)}</div>
          {(ticket.requesterName || '').trim() ? (
            <div className="mobileMeta" style={{ marginTop: 4 }}>Заявитель: {(ticket.requesterName || '').trim()}</div>
          ) : null}
          <div className="mobileTicketProblemPreview">{problemPreview}</div>
          <div className="mobileMeta" style={{ marginTop: 6 }}>Исполнитель: {assignedTechnicianDisplay(ticket)}</div>
          {slaLine ? (
            <div className="mobileTicketSlaRow" style={{ marginTop: 6 }}>
              <span className="mobileTicketSlaCountdown">{slaLine}</span>
            </div>
          ) : null}
        </div>
      </Link>

      {assignFooter ? (
        <div style={{ padding: '0 12px 12px' }}>
          <button
            type="button"
            className="mobileBtn mobileBtnSecondary"
            style={{ width: '100%' }}
            disabled={assignFooter.disabled}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              assignFooter.onOpen()
            }}
          >
            Назначить
          </button>
        </div>
      ) : null}

      {actionLabel === 'Запросить назначение' ? (
        <div style={{ padding: '8px 12px 0' }}>
          {claimReason ? <MobileClaimReasonHintBox reason={claimReason} className="mobileUxHintReason--compact" /> : <MobileBoardClaimFallbackHint />}
        </div>
      ) : null}

      {actionLabel ? (
        <div style={{ padding: '0 12px 12px' }}>
          <button
            type="button"
            className={`mobileBtn${
              actionLabel === 'Взять'
                ? ' mobileBtn--claim'
                : actionLabel === 'Запросить назначение'
                  ? ' mobileBtnSecondary'
                  : actionLabel === 'Начать'
                    ? ' mobileBtn--start'
                    : ' mobileBtn--done'
            }`}
            style={{ width: '100%' }}
            disabled={actionBusy}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAction?.(ticket)
            }}
          >
            {actionProgressLabel || actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
