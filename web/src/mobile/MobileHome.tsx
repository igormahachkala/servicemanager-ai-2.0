import { useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

function ticketSubtitle(card: api.TicketCard) {
  return card.location?.name || card.pointName || 'Без локации'
}

function ticketCategory(card: api.TicketCard) {
  return card.category?.name || card.title || 'Без категории'
}

function getPrimaryActionLabel(ticket: api.TicketCard, isTechnician: boolean): 'Взять' | 'Начать' | 'Закрыть' | null {
  if (!isTechnician) return null
  if (ticket.status === 'NEW') return 'Взять'
  if (ticket.status === 'ASSIGNED') return 'Начать'
  if (ticket.status === 'IN_PROGRESS') return 'Закрыть'
  return null
}

function TicketCard(props: {
  ticket: api.TicketCard
  ticketHref: string
  actionLabel?: 'Взять' | 'Начать' | 'Закрыть' | null
  onAction?: (ticket: api.TicketCard) => void
  actionPending?: boolean
}) {
  const { ticket, ticketHref, actionLabel = null, onAction, actionPending = false } = props
  return (
    <div className="mobileCard" style={{ padding: 0, overflow: 'hidden' }}>
      <Link to={ticketHref} className="mobileCardClickable" style={{ borderRadius: 0 }}>
        <div style={{ padding: 12 }}>
          <div className="mobileRow">
            <strong>{ticketSubtitle(ticket)}</strong>
            <span className="mobileMeta">{ticket.status}</span>
          </div>
          <div className="mobileMeta" style={{ marginTop: 4 }}>
            {ticketCategory(ticket)}
          </div>
        </div>
      </Link>
      {actionLabel ? (
        <div style={{ padding: '0 12px 12px' }}>
          <button
            type="button"
            className="mobileBtn"
            style={{ width: '100%' }}
            disabled={actionPending}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAction?.(ticket)
            }}
          >
            {actionPending ? 'Выполняем...' : actionLabel}
          </button>
        </div>
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

  const closeFileRef = useRef<HTMLInputElement | null>(null)
  const [closeModal, setCloseModal] = useState<{
    ticketId: string
    title: string
    file: File | null
    comment: string
    err: string
  } | null>(null)

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
        if (!isTechnician) {
          throw new Error('Закрытие доступно технику')
        }
        setCloseModal({
          ticketId: ticket.id,
          title: `${ticketSubtitle(ticket)} · ${ticketCategory(ticket)}`,
          file: null,
          comment: '',
          err: '',
        })
        return
      }
    },
    onSuccess: async (_data, ticket) => {
      if (ticket.status === 'IN_PROGRESS') return
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
  })

  const closeM = useMutation({
    mutationFn: async () => {
      if (!closeModal) throw new Error('Нет данных для закрытия')
      if (!closeModal.file) throw new Error('Нужно фото отчёта (WORK_REPORT)')
      const comment = closeModal.comment.trim()
      if (comment.length < 3) throw new Error('Нужен короткий комментарий (backend требует комментарий для DONE)')

      await api.uploadTicketAttachment(closeModal.ticketId, closeModal.file, scope)
      await api.updateTicketStatus(closeModal.ticketId, { status: 'DONE', comment }, scope)
    },
    onSuccess: async () => {
      setCloseModal(null)
      if (closeFileRef.current) closeFileRef.current.value = ''
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (e: any) => {
      if (!closeModal) return
      setCloseModal({ ...closeModal, err: e?.message || String(e) })
    },
  })

  const closeBusy = closeM.isPending

  const primaryPending = actionM.isPending || closeBusy

  const ticketHref = (ticketId: string) => api.appendScopeToPath(`/tickets/${ticketId}`, scope, meQ.data)

  const closeCanSubmit = useMemo(() => {
    if (!closeModal) return false
    return !!closeModal.file && closeModal.comment.trim().length >= 3 && !closeBusy
  }, [closeBusy, closeModal])

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
                  ticketHref={ticketHref(ticket.id)}
                  actionLabel={getPrimaryActionLabel(ticket, isTechnician)}
                  actionPending={primaryPending}
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
                  ticketHref={ticketHref(ticket.id)}
                  actionLabel={getPrimaryActionLabel(ticket, isTechnician)}
                  actionPending={primaryPending}
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
                .map((ticket) => <TicketCard key={ticket.id} ticket={ticket} ticketHref={ticketHref(ticket.id)} />)
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
                .map((ticket) => <TicketCard key={ticket.id} ticket={ticket} ticketHref={ticketHref(ticket.id)} />)
            )}
          </section>
        </>
      )}

      {closeModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 24, 39, 0.55)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <div className="mobileCard" style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
            <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 900 }}>Закрыть заявку</div>
                <div className="mobileMeta" style={{ marginTop: 4 }}>
                  {closeModal.title}
                </div>
              </div>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary"
                disabled={closeBusy}
                onClick={() => {
                  setCloseModal(null)
                  if (closeFileRef.current) closeFileRef.current.value = ''
                }}
              >
                Отмена
              </button>
            </div>

            {closeModal.err ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{closeModal.err}</div> : null}

            <div className="mobileForm" style={{ marginTop: 12 }}>
              <label>
                Фото отчёта (WORK_REPORT) *
                <input
                  ref={closeFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={closeBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setCloseModal((prev) => (prev ? { ...prev, file, err: '' } : prev))
                  }}
                />
              </label>

              <label>
                Комментарий к закрытию *
                <textarea
                  rows={3}
                  value={closeModal.comment}
                  disabled={closeBusy}
                  placeholder="Коротко: что сделали / результат"
                  onChange={(e) => setCloseModal((prev) => (prev ? { ...prev, comment: e.target.value, err: '' } : prev))}
                />
              </label>

              <button className="mobileBtn" disabled={!closeCanSubmit} onClick={() => closeM.mutate()}>
                {closeBusy ? 'Закрываем...' : 'Загрузить отчёт и закрыть'}
              </button>
              <div className="mobileMeta">
                Сначала загрузим фото на тикет (purpose WORK_REPORT), затем PATCH статуса DONE с комментарием (требование backend).
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
