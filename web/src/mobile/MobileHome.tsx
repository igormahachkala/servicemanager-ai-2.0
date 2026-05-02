import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

function ticketSubtitle(card: api.TicketCard) {
  return card.location?.name || card.pointName || 'Без локации'
}

function ticketCategory(card: api.TicketCard) {
  return card.category?.name || card.title || 'Без категории'
}

function getPrimaryActionLabel(ticket: api.TicketCard): 'Взять' | 'Начать' | 'Закрыть' | null {
  if (ticket.status === 'NEW') return 'Взять'
  if (ticket.status === 'ASSIGNED') return 'Начать'
  if (ticket.status === 'IN_PROGRESS') return 'Закрыть'
  return null
}

function TicketCard(props: {
  ticket: api.TicketCard
  actionLabel?: 'Взять' | 'Начать' | 'Закрыть' | null
  onAction?: (ticket: api.TicketCard) => void
  actionPending?: boolean
}) {
  const { ticket, actionLabel = null, onAction, actionPending = false } = props
  return (
    <div className="mobileCard">
      <div className="mobileRow">
        <strong>{ticketSubtitle(ticket)}</strong>
        <span className="mobileMeta">{ticket.status}</span>
      </div>
      <div className="mobileMeta" style={{ marginTop: 4 }}>
        {ticketCategory(ticket)}
      </div>
      {actionLabel ? (
        <button
          className="mobileBtn"
          style={{ width: '100%', marginTop: 10 }}
          disabled={actionPending}
          onClick={() => onAction?.(ticket)}
        >
          {actionPending ? 'Выполняем...' : actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function MobileHome() {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId()).trim()
  const scope = {
    linkedClientCompanyId: linkedClientCompanyId || undefined,
    companyId: companyId || undefined,
  }

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const queryClient = useQueryClient()
  const boardQ = useQuery({
    queryKey: ['mobile-home-board', linkedClientCompanyId, companyId],
    queryFn: () => api.board({ linkedClientCompanyId: scope.linkedClientCompanyId, companyId: scope.companyId, take: 30 }),
    enabled: !!meQ.data,
  })
  const availableQ = useQuery({
    queryKey: ['mobile-home-available'],
    queryFn: api.availableTickets,
    enabled: meQ.data?.role === 'TECHNICIAN',
  })

  const cards = boardQ.data?.columns.flatMap((col) => col.cards || []) || []
  const inWork = cards.filter((card) => card.status === 'IN_PROGRESS' || card.status === 'ASSIGNED')
  const myTickets = cards.slice(0, 6)
  const available = (availableQ.data || []) as api.TicketCard[]
  const isTechnician = meQ.data?.role === 'TECHNICIAN'
  const contextLabel = linkedClientCompanyId
    ? `Клиентский контур: ${linkedClientCompanyId}`
    : meQ.data?.companyName
      ? `Компания: ${meQ.data.companyName}`
      : 'Компания: текущий контур'

  const actionM = useMutation({
    mutationFn: async (ticket: api.TicketCard) => {
      if (ticket.status === 'NEW') {
        await api.claim(ticket.id, scope)
        return
      }
      if (ticket.status === 'ASSIGNED') {
        await api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, scope)
        return
      }
      if (ticket.status === 'IN_PROGRESS') {
        await api.updateTicketStatus(ticket.id, { status: 'DONE' }, scope)
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
  })

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Главная</h1>
        <div className="mobileSubtitle">Операционный экран без desktop-шумов</div>
      </div>

      <div className="mobileCard" style={{ padding: 12 }}>
        <div className="mobileMeta">{contextLabel}</div>
        <Link to={api.appendScopeToPath('/m/create', scope, meQ.data)}>
          <button className="mobileBtn" style={{ width: '100%', marginTop: 8 }}>
            Создать
          </button>
        </Link>
      </div>

      {boardQ.isError ? <div className="mobileNotice mobileNoticeError">{String((boardQ.error as any)?.message || boardQ.error)}</div> : null}
      {availableQ.isError ? <div className="mobileNotice mobileNoticeError">{String((availableQ.error as any)?.message || availableQ.error)}</div> : null}

      {isTechnician ? (
        <>
          <section className="mobileSection">
            <h2 className="mobileSectionTitle">В работе</h2>
            {inWork.length === 0 ? (
              <div className="mobileCard mobileMeta">Нет заявок в работе</div>
            ) : (
              inWork.slice(0, 4).map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  actionLabel={getPrimaryActionLabel(ticket)}
                  actionPending={actionM.isPending}
                  onAction={(next) => actionM.mutate(next)}
                />
              ))
            )}
          </section>

          <section className="mobileSection">
            <h2 className="mobileSectionTitle">Доступные</h2>
            {available.length === 0 ? (
              <div className="mobileCard mobileMeta">Нет доступных заявок</div>
            ) : (
              available.slice(0, 4).map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  actionLabel={getPrimaryActionLabel(ticket)}
                  actionPending={actionM.isPending}
                  onAction={(next) => actionM.mutate(next)}
                />
              ))
            )}
          </section>
        </>
      ) : (
        <>
          <section className="mobileSection">
            <h2 className="mobileSectionTitle">В работе</h2>
            {myTickets.filter((row) => row.status === 'ASSIGNED' || row.status === 'IN_PROGRESS').length === 0 ? (
              <div className="mobileCard mobileMeta">Нет заявок в работе</div>
            ) : (
              myTickets
                .filter((row) => row.status === 'ASSIGNED' || row.status === 'IN_PROGRESS')
                .slice(0, 4)
                .map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </section>
          <section className="mobileSection">
            <h2 className="mobileSectionTitle">Доступные</h2>
            {myTickets.filter((row) => row.status === 'NEW').length === 0 ? (
              <div className="mobileCard mobileMeta">Нет доступных заявок</div>
            ) : (
              myTickets
                .filter((row) => row.status === 'NEW')
                .slice(0, 4)
                .map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </section>
        </>
      )}
    </div>
  )
}
