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
  const urgent = mobileTicketPriorityIsUrgent(ticket.priority ?? 'NORMAL') || ticket.urgency === 'URGENT'
  const overdue = ticket.slaBreached
  const statusClass = `mobileTicketStatus mobileTicketStatus--${ticket.status}`
  const cardClass = ['mobileCard', 'mobileTicketCard', 'mobileTicketCardCompact', `mobileTicketCard--${ticket.status}`, overdue ? 'mobileTicketCardSlaOverdue' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cardClass} style={{ padding: 0, overflow: 'hidden' }}>
      <Link to={ticketHref} state={linkState ?? mobileTicketNavState('home')} className="mobileCardClickable" style={{ borderRadius: 0 }}>
        <div className="mobileTicketCardBody">
          {/* Номер + статус */}
          <div className="mobileRow">
            <strong>{mobileTicketNumberTitle(ticket.ticketNumber)}</strong>
            <span className={statusClass}>{mobileTicketStatusLabelRu(ticket.status)}</span>
          </div>
          {/* Объект (категория · точка) */}
          <div className="mobileMeta mobileTicketCardObject">{mobileTicketCategoryLocationFromCard(ticket)}</div>
          {/* Исполнитель + срочность */}
          <div className="mobileTicketCardMetaRow">
            <span className="mobileMeta mobileTicketCardAssignee">Исполнитель: {assignedTechnicianDisplay(ticket)}</span>
            {urgent ? <span className="mobileSlaUrgentPill">Срочно</span> : null}
          </div>
          {/* SLA */}
          {slaLine ? (
            <div className="mobileTicketSlaRow">
              <span className="mobileTicketSlaCountdown">{slaLine}</span>
            </div>
          ) : null}
          {ticket.assignmentRequestedByCurrentUser ? (
            <div className="mobileAssignmentRequestedRow">
              <span className="mobileAssignmentRequestedBadge">Запрос отправлен</span>
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
