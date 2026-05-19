import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

function fmt(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('ru-RU')
  } catch {
    return dt
  }
}

function statusLabel(status?: string) {
  if (status === 'NEW') return 'Новая'
  if (status === 'ASSIGNED') return 'Назначена'
  if (status === 'IN_PROGRESS') return 'В работе'
  if (status === 'DONE') return 'Завершена'
  if (status === 'CANCELED') return 'Отменена'
  return status || '—'
}

function urgencyLabel(urgency?: string) {
  if (urgency === 'URGENT') return 'Срочно'
  if (urgency === 'NOT_URGENT') return 'Не срочно'
  return urgency || '—'
}

function toTitle(ticket: any) {
  if (ticket?.ticketNumber != null && Number.isFinite(Number(ticket.ticketNumber))) return `Заявка #${ticket.ticketNumber}`
  if (ticket?.title) return ticket.title
  if (ticket?.problemText) return ticket.problemText
  return 'Заявка'
}

function toCategory(ticket: any) {
  return ticket?.category?.name || ticket?.problemCategory?.name || '—'
}

function toAssignedEmail(ticket: any) {
  return ticket?.assignedTechnician?.email || '—'
}

function toSla(ticket: any) {
  return ticket?.slaDueAt || ticket?.slaBreachedAt || null
}

function TicketCard(props: {
  ticket: any
  showClaim?: boolean
  showStart?: boolean
  claiming?: boolean
  starting?: boolean
  onClaim?: () => void
  onStart?: () => void
}) {
  const { ticket, showClaim, showStart, claiming, starting, onClaim, onStart } = props

  return (
    <div className="ticket" style={{ display: 'grid', gap: 10 }}>
      <div>
        <div className="ticketTitle">{toTitle(ticket)}</div>
        <div className="muted small" style={{ marginTop: 4 }}>
          {toCategory(ticket)}
        </div>
      </div>

      <div className="ticketMeta">
        <span className="tag">{statusLabel(ticket?.status)}</span>
        <span className="tag">{urgencyLabel(ticket?.urgency)}</span>
        {ticket?.slaBreached || ticket?.slaBreachedAt ? <span className="tag danger">SLA нарушен</span> : null}
      </div>

      <div className="muted small" style={{ display: 'grid', gap: 4 }}>
        <div>Создана: {fmt(ticket?.createdAt)}</div>
        <div>SLA: {fmt(toSla(ticket))}</div>
        <div>Техник: {toAssignedEmail(ticket)}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to={`/tickets/${ticket?.id}`}>
          <button className="ghost">Открыть</button>
        </Link>

        {showClaim ? (
          <button onClick={onClaim} disabled={claiming}>
            {claiming ? 'Берём…' : 'Взять заявку'}
          </button>
        ) : null}

        {showStart ? (
          <button onClick={onStart} disabled={starting}>
            {starting ? 'Запуск…' : 'Начать работу'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function TechnicianPage() {
  const qc = useQueryClient()

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  })

  const technicianQ = useQuery({
    queryKey: ['technician-me'],
    queryFn: api.technicianMe,
  })

  const ticketsQ = useQuery({
    queryKey: ['tickets'],
    queryFn: api.tickets,
  })

  const availableQ = useQuery({
    queryKey: ['tickets-available'],
    queryFn: () => api.availableTickets(),
  })

  const claimM = useMutation({
    mutationFn: (ticketId: string) => api.claimTicket(ticketId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['tickets'] }),
        qc.invalidateQueries({ queryKey: ['tickets-available'] }),
        qc.invalidateQueries({ queryKey: ['analytics-overview'] }),
      ])
    },
  })

  const startM = useMutation({
    mutationFn: (ticketId: string) =>
      api.updateTicketStatus(ticketId, {
        status: 'IN_PROGRESS',
        comment: 'Работа начата техником',
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['tickets'] }),
        qc.invalidateQueries({ queryKey: ['tickets-available'] }),
        qc.invalidateQueries({ queryKey: ['analytics-overview'] }),
      ])
    },
  })

  const allTickets = Array.isArray(ticketsQ.data) ? ticketsQ.data : []
  const availableTickets = Array.isArray(availableQ.data) ? availableQ.data : []
  const technicianId = technicianQ.data?.id || meQ.data?.id

  const myTickets = allTickets.filter((ticket: any) => {
    const assignedId =
      ticket?.assignedTechnicianId ||
      ticket?.assignedTechnician?.id ||
      null

    return (
      assignedId &&
      technicianId &&
      assignedId === technicianId &&
      (ticket?.status === 'ASSIGNED' || ticket?.status === 'IN_PROGRESS')
    )
  })

  const assignedTickets = myTickets.filter((ticket: any) => ticket?.status === 'ASSIGNED')
  const inProgressTickets = myTickets.filter((ticket: any) => ticket?.status === 'IN_PROGRESS')

  const isLoading =
    meQ.isFetching ||
    technicianQ.isFetching ||
    ticketsQ.isFetching ||
    availableQ.isFetching

  const error =
    (meQ.error as any)?.message ||
    (technicianQ.error as any)?.message ||
    (ticketsQ.error as any)?.message ||
    (availableQ.error as any)?.message ||
    (claimM.error as any)?.message ||
    (startM.error as any)?.message ||
    null

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Кабинет техника</h2>
          <div className="muted small">Упрощённый technician workflow как основа mobile-ready интерфейса</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/board">
            <button className="ghost">Доска</button>
          </Link>
          <Link to="/tickets/new">
            <button className="ghost">Создать заявку</button>
          </Link>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      <div
        className="panel"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div className="muted small">Текущий техник</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{technicianQ.data?.email || meQ.data?.email || '—'}</div>
        </div>
        <div>
          <div className="muted small">Назначено</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{isLoading ? '—' : assignedTickets.length}</div>
        </div>
        <div>
          <div className="muted small">В работе</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{isLoading ? '—' : inProgressTickets.length}</div>
        </div>
        <div>
          <div className="muted small">Доступно взять</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{isLoading ? '—' : availableTickets.length}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Мои заявки</h3>

          {isLoading ? <div className="muted small">Загрузка…</div> : null}

          {!isLoading && myTickets.length === 0 ? (
            <div className="muted small">У техника пока нет активных заявок.</div>
          ) : null}

          <div style={{ display: 'grid', gap: 10 }}>
            {assignedTickets.map((ticket: any) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                showStart
                starting={startM.isPending}
                onStart={() => startM.mutate(ticket.id)}
              />
            ))}

            {inProgressTickets.map((ticket: any) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Доступные заявки</h3>

          {isLoading ? <div className="muted small">Загрузка…</div> : null}

          {!isLoading && availableTickets.length === 0 ? (
            <div className="muted small">Сейчас нет доступных заявок для взятия.</div>
          ) : null}

          <div style={{ display: 'grid', gap: 10 }}>
            {availableTickets.map((ticket: any) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                showClaim
                claiming={claimM.isPending}
                onClaim={() => claimM.mutate(ticket.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Что это даёт дальше</h3>
        <div className="muted small">
          Этот экран — первый шаг к mobile phase. На его основе дальше можно делать technician-only маршрут,
          упрощённые действия по статусам, PWA и offline-ready логику.
        </div>
      </div>
    </div>
  )
}
