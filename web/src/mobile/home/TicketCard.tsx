import { Link } from 'react-router-dom'
import * as api from '../../lib/api'
import {
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

function fmtCardTime(dt: string): string {
  try {
    const d = new Date(dt)
    const today = new Date()
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    if (isToday) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

function fmtCardLocation(ticket: api.TicketCard): string {
  const loc = ticket.location
  if (!loc) return ticket.pointName || ''
  const parts: string[] = []
  if (loc.city) parts.push(loc.city)
  if (loc.address) parts.push(loc.address)
  return parts.join(', ') || loc.name || ''
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
  const cardClass = ['mobileCard', 'mobileTicketCard', `mobileTicketCard--${ticket.status}`, overdue ? 'mobileTicketCardSlaOverdue' : '']
    .filter(Boolean)
    .join(' ')

  const locationText = fmtCardLocation(ticket)
  const timeText = fmtCardTime(ticket.createdAt)
  const descText = (ticket.description || '').trim()
  const assigneeText = assignedTechnicianDisplay(ticket)

  return (
    <div className={cardClass} style={{ padding: 0, overflow: 'hidden' }}>
      <Link to={ticketHref} state={linkState ?? mobileTicketNavState('home')} className="mobileCardClickable" style={{ borderRadius: 0 }}>
        <div className="mobileTicketCardV2">
          {/* Row 1: number · category + time */}
          <div className="mobileTicketCardV2Top">
            <span className="mobileTicketCardV2Number">
              {mobileTicketNumberTitle(ticket.ticketNumber)}
              {ticket.category?.name ? (
                <span className="mobileTicketCardV2Cat"> · {ticket.category.name}</span>
              ) : null}
            </span>
            {timeText ? <span className="mobileTicketCardV2Time">{timeText}</span> : null}
          </div>

          {/* Row 2: location */}
          {locationText ? <div className="mobileTicketCardV2Location">{locationText}</div> : null}

          {/* Row 3: description snippet */}
          {descText ? <div className="mobileTicketCardV2Desc">{descText}</div> : null}

          {/* Row 4: assignee (small) + urgent badge + sla + status */}
          <div className="mobileTicketCardV2Bottom">
            <span className="mobileMeta" style={{ fontSize: '0.75rem' }}>
              {assigneeText !== '—' ? assigneeText : null}
              {urgent ? <span className="mobileSlaUrgentPill" style={{ marginLeft: 6 }}>Срочно</span> : null}
              {slaLine ? <span className="mobileTicketSlaCountdown" style={{ marginLeft: 6 }}>{slaLine}</span> : null}
            </span>
            <span className={statusClass}>{mobileTicketStatusLabelRu(ticket.status)}</span>
          </div>

          {ticket.assignmentRequestedByCurrentUser ? (
            <div className="mobileAssignmentRequestedRow">
              <span className="mobileAssignmentRequestedBadge">Запрос отправлен</span>
            </div>
          ) : null}
        </div>
      </Link>

      {assignFooter ? (
        <div style={{ padding: '0 14px 12px' }}>
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
        <div style={{ padding: '8px 14px 0' }}>
          {claimReason ? <MobileClaimReasonHintBox reason={claimReason} className="mobileUxHintReason--compact" /> : <MobileBoardClaimFallbackHint />}
        </div>
      ) : null}

      {actionLabel ? (
        <div style={{ padding: '0 14px 12px' }}>
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
