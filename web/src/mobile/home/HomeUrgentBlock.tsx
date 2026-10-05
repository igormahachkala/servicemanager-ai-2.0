import { Link } from 'react-router-dom'

import type { TicketCard } from '../../lib/api'
import { mobileTicketCategoryLocationFromCard, mobileTicketNumberTitle, type MobileTicketNavState } from '../mobileTicketDisplay'

type Props = {
  tickets: TicketCard[]
  ticketHref: (ticket: TicketCard) => string
  ticketLinkState: (ticket: TicketCard) => MobileTicketNavState
}

const MAX_ROWS = 3

/**
 * SMA-MOBILE-SERVICE-OS Phase 0+1 — приоритетный блок срочных заявок вверху
 * Главной. Пустой список → блок не рендерится (контекстный, без пустого места).
 */
export function HomeUrgentBlock({ tickets, ticketHref, ticketLinkState }: Props) {
  if (!tickets.length) return null
  const shown = tickets.slice(0, MAX_ROWS)

  return (
    <section className="mobileHomeUrgent" aria-label={`Срочные заявки: ${tickets.length}`}>
      <div className="mobileHomeUrgentHead">
        <span className="mobileHomeUrgentDot" aria-hidden />
        <span className="mobileHomeUrgentTitle">СРОЧНО · {tickets.length}</span>
      </div>
      <div className="mobileHomeUrgentList">
        {shown.map((ticket) => (
          <Link
            key={ticket.id}
            to={ticketHref(ticket)}
            state={ticketLinkState(ticket)}
            className="mobileHomeUrgentItem"
          >
            <span className="mobileHomeUrgentItemMain">
              <span className="mobileHomeUrgentItemNo">{mobileTicketNumberTitle(ticket.ticketNumber)}</span>
              <span className="mobileHomeUrgentItemText">{mobileTicketCategoryLocationFromCard(ticket)}</span>
            </span>
            <span className="mobileHomeUrgentOpen" aria-hidden>Открыть ›</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
