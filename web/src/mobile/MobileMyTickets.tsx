import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

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
  const [filter, setFilter] = useState<FilterKey>('active')

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
          <div className="mobileCard" key={ticket.id}>
            <div className="mobileRow">
              <strong>{ticket.location?.name || ticket.pointName || 'Без локации'}</strong>
              <span className="mobileMeta">{ticket.status}</span>
            </div>
            <div className="mobileMeta" style={{ marginTop: 6 }}>
              {ticket.category?.name || ticket.title || 'Без категории'}
            </div>
            <div className="mobileMeta" style={{ marginTop: 6 }}>
              Обновлено: {formatDate(ticket.createdAt)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
