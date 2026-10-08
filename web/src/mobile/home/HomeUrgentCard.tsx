import { Link } from 'react-router-dom'

import type { TicketCard } from '../../lib/api'
import { mobileTicketCategoryLocationFromCard, mobileTicketNumberTitle, type MobileTicketNavState } from '../mobileTicketDisplay'
import { formatTicketAgeShort, HOME_URGENT_PREVIEW_MAX } from './homeUrgent'

type Props = {
  tickets: TicketCard[]
  ticketHref: (ticket: TicketCard) => string
  ticketLinkState: (ticket: TicketCard) => MobileTicketNavState
  onViewAll: () => void
}

/**
 * SMA-MOBILE-HOME — полноценная операционная карточка «Срочные заявки».
 * Та же design-система, что у Home-карт (radius/spacing/typography), светлый
 * красный фон + красный акцент в иконке/счётчике. Пустой список → не рендерится.
 * Count/превью и «Все срочные» используют ЕДИНЫЙ canonical-предикат (homeUrgent).
 */
export function HomeUrgentCard({ tickets, ticketHref, ticketLinkState, onViewAll }: Props) {
  if (!tickets.length) return null
  const preview = tickets.slice(0, HOME_URGENT_PREVIEW_MAX)

  return (
    <section className="mobileHomeUrgentCard" aria-label={`Срочные заявки: ${tickets.length}`}>
      <div className="mobileHomeUrgentHead">
        <span className="mobileHomeUrgentIcon" aria-hidden>
          {/* Tabler alert-triangle */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" />
            <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
            <path d="M12 16h.01" />
          </svg>
        </span>
        <span className="mobileHomeUrgentHeadBody">
          <span className="mobileHomeUrgentTitle">Срочные заявки</span>
          <span className="mobileHomeUrgentSub">{tickets.length} требуют внимания</span>
        </span>
        <span className="mobileHomeUrgentBadge">{tickets.length}</span>
      </div>

      <div className="mobileHomeUrgentRows">
        {preview.map((ticket) => {
          const age = formatTicketAgeShort(ticket.createdAt)
          return (
            <Link key={ticket.id} to={ticketHref(ticket)} state={ticketLinkState(ticket)} className="mobileHomeUrgentRow">
              <span className="mobileHomeUrgentRowMain">
                <span className="mobileHomeUrgentRowNo">{mobileTicketNumberTitle(ticket.ticketNumber)}</span>
                <span className="mobileHomeUrgentRowText">{mobileTicketCategoryLocationFromCard(ticket)}</span>
              </span>
              {age ? <span className="mobileHomeUrgentRowAge">{age}</span> : null}
            </Link>
          )
        })}
      </div>

      <button type="button" className="mobileHomeUrgentAll" onClick={onViewAll}>
        Все срочные
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </section>
  )
}
