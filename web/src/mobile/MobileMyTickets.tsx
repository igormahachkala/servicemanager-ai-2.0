import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  mobileTicketCategoryLocationFromCard,
  mobileTicketNavState,
  mobileTicketNumberTitle,
} from './mobileTicketDisplay'

type FilterKey = 'active' | 'new' | 'closed'

const filterMap: Record<FilterKey, api.TicketStatus[]> = {
  active: ['ASSIGNED', 'IN_PROGRESS'],
  new: ['NEW'],
  closed: ['DONE', 'CANCELED'],
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', { hour12: false })
}

export function MobileMyTickets() {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId()).trim()
  const scope = {
    linkedClientCompanyId: linkedClientCompanyId || undefined,
    companyId: companyId || undefined,
  }
  const [filter, setFilter] = useState<FilterKey>('active')

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const boardQ = useQuery({
    queryKey: ['mobile-my-board', linkedClientCompanyId, companyId],
    queryFn: () => api.board({ linkedClientCompanyId: linkedClientCompanyId || undefined, companyId: companyId || undefined, take: 60 }),
  })

  const allTickets = boardQ.data?.columns.flatMap((col) => col.cards || []) || []
  const statuses = filterMap[filter]
  const filteredTickets = useMemo(
    () => allTickets.filter((ticket) => statuses.includes(ticket.status)),
    [allTickets, statuses],
  )

  const ticketHref = (ticketId: string) => api.appendScopeToPath(`/m/tickets/${ticketId}`, scope, meQ.data)

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Мои заявки</h1>
        <div className="mobileSubtitle">Личный список без таблиц и desktop-плотности</div>
      </div>

      <div className="mobileActionRow">
        <button
          className={filter === 'active' ? 'mobileBtn' : 'mobileBtn mobileBtnSecondary'}
          onClick={() => setFilter('active')}
        >
          Активные
        </button>
        <button
          className={filter === 'new' ? 'mobileBtn' : 'mobileBtn mobileBtnSecondary'}
          onClick={() => setFilter('new')}
        >
          Новые
        </button>
        <button
          className={filter === 'closed' ? 'mobileBtn' : 'mobileBtn mobileBtnSecondary'}
          onClick={() => setFilter('closed')}
        >
          Закрытые
        </button>
      </div>

      {boardQ.isError ? <div className="mobileNotice mobileNoticeError">{String((boardQ.error as any)?.message || boardQ.error)}</div> : null}

      {filteredTickets.length === 0 ? (
        <div className="mobileCard mobileMeta">Список пуст</div>
      ) : (
        filteredTickets.map((ticket) => (
          <Link
            key={ticket.id}
            to={ticketHref(ticket.id)}
            state={mobileTicketNavState('my')}
            className="mobileCard mobileCardClickable"
            style={{ display: 'block', padding: 12 }}
          >
            <div className="mobileRow">
              <strong>{mobileTicketNumberTitle(ticket.ticketNumber)}</strong>
              <span className="mobileMeta">{ticket.status}</span>
            </div>
            <div className="mobileMeta" style={{ marginTop: 6 }}>
              {mobileTicketCategoryLocationFromCard(ticket)}
            </div>
            <div className="mobileMeta" style={{ marginTop: 6 }}>
              Обновлено: {formatDate(ticket.createdAt)}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
