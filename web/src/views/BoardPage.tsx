import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

function fmt(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('ru-RU')
  } catch {
    return dt
  }
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function statusLabel(status: api.TicketStatus) {
  if (status === 'NEW') return 'Новые'
  if (status === 'ASSIGNED') return 'Назначенные'
  if (status === 'IN_PROGRESS') return 'В работе'
  if (status === 'DONE') return 'Завершённые'
  if (status === 'CANCELED') return 'Отменённые'
  return status
}

function urgencyLabel(urgency: api.TicketUrgency) {
  if (urgency === 'URGENT') return 'Срочно'
  if (urgency === 'NOT_URGENT') return 'Не срочно'
  return urgency
}

function UrgencyTag({ urgency }: { urgency: api.TicketUrgency }) {
  const isUrgent = urgency === 'URGENT'
  const style: React.CSSProperties = isUrgent
    ? { background: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' }
    : { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#374151' }

  return (
    <span className="tag" style={style}>
      {urgencyLabel(urgency)}
    </span>
  )
}

function SkeletonBox({ w, h }: { w: number | string; h: number }) {
  return <div style={{ width: w, height: h, borderRadius: 10, background: '#eef2ff', border: '1px solid #e6e8f0' }} />
}

function TicketSkeleton() {
  return (
    <div className="ticket" style={{ pointerEvents: 'none' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <SkeletonBox w="85%" h={14} />
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonBox w={70} h={18} />
          <SkeletonBox w={90} h={18} />
        </div>
        <SkeletonBox w="60%" h={12} />
      </div>
    </div>
  )
}

function ColumnSkeleton({ title }: { title: string }) {
  return (
    <div className="col">
      <div className="colhead">
        <div className="coltitle">{title}</div>
        <div className="pill">—</div>
      </div>
      <div className="muted small" style={{ marginBottom: 8 }}>
        SLA: —
      </div>
      <div className="cards">
        <TicketSkeleton />
        <TicketSkeleton />
        <TicketSkeleton />
      </div>
    </div>
  )
}

function providerScopeLabel(role?: api.ServiceContractRole) {
  if (role === 'PRIMARY') return 'PRIMARY provider'
  if (role === 'SECONDARY') return 'SECONDARY provider'
  return ''
}

export function BoardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [take, setTake] = useState(120)
  const [linkedClientCompanyId, setLinkedClientCompanyId] = useState(() => searchParams.get('linkedClientCompanyId') || '')

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const linkedClientsQ = useQuery({
    queryKey: ['linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: meQ.data?.role === 'ADMIN' || meQ.data?.role === 'MASTER' || meQ.data?.role === 'DISPATCHER' || meQ.data?.role === 'NETWORK_DIRECTOR',
  })

  useEffect(() => {
    const nextLinkedClientCompanyId = searchParams.get('linkedClientCompanyId') || ''
    if (nextLinkedClientCompanyId !== linkedClientCompanyId) {
      setLinkedClientCompanyId(nextLinkedClientCompanyId)
    }
  }, [searchParams, linkedClientCompanyId])

  useEffect(() => {
    if (!linkedClientCompanyId && linkedClientsQ.data?.length) {
      const primary = linkedClientsQ.data.find((item) => item.role === 'PRIMARY')
      if (primary) setLinkedClientCompanyId(primary.clientCompany.id)
    }
  }, [linkedClientsQ.data, linkedClientCompanyId])

  const selectedLinkedClient = useMemo(
    () => linkedClientsQ.data?.find((item) => item.clientCompany.id === linkedClientCompanyId) || null,
    [linkedClientsQ.data, linkedClientCompanyId],
  )

  const boardQ = useQuery({
    queryKey: ['board', { take, linkedClientCompanyId }],
    queryFn: () => api.board({ take, linkedClientCompanyId: linkedClientCompanyId || undefined }),
  })

  const columns = useMemo(() => boardQ.data?.columns || [], [boardQ.data])
  const cardsAll = useMemo(() => columns.flatMap((c) => c.cards || []), [columns])

  const stats = useMemo(() => {
    const now = new Date()
    const open = cardsAll.filter((c) => c.status !== 'DONE' && c.status !== 'CANCELED').length
    const today = cardsAll.filter((c) => sameDay(new Date(c.createdAt), now)).length
    const urgent = cardsAll.filter((c) => c.urgency === 'URGENT').length
    const breachedByCol = columns.reduce((sum, col) => sum + (col.sla?.breached || 0), 0)
    const atRiskByCol = columns.reduce((sum, col) => sum + (col.sla?.atRisk || 0), 0)
    return { open, today, urgent, breachedByCol, atRiskByCol }
  }, [cardsAll, columns])

  const isEmpty = !boardQ.isFetching && !boardQ.isError && columns.every((c) => (c.cards?.length || 0) === 0)

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Доска заявок</h2>
          <div className="muted small">
            {boardQ.isFetching ? 'Загрузка…' : boardQ.data ? `Всего: ${boardQ.data.meta.totalTickets}` : '—'}
            {boardQ.data ? ` · лимит последних: ${boardQ.data.meta.limitedToLast}` : ''}
          </div>
          {selectedLinkedClient ? (
            <div className="muted small" style={{ marginTop: 4 }}>
              Видимость по клиенту: {selectedLinkedClient.clientCompany.name} · {providerScopeLabel(selectedLinkedClient.role)}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={() => boardQ.refetch()} disabled={boardQ.isFetching}>
            Обновить
          </button>
          <Link to="/tickets/new">
            <button className="ghost">Создать заявку</button>
          </Link>
        </div>
      </div>

      {linkedClientsQ.isLoading || (linkedClientsQ.data && linkedClientsQ.data.length > 0) ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Мои клиенты</div>

          {linkedClientsQ.isLoading ? <div className="muted small">Загрузка...</div> : null}

          <div style={{ display: 'grid', gap: 10 }}>
            {(linkedClientsQ.data || []).map((item) => (
              <div
                key={item.clientCompany.id}
                className="card"
                style={{
                  border: linkedClientCompanyId === item.clientCompany.id ? '1px solid #c7d2fe' : '1px solid #e5e7eb',
                  background: linkedClientCompanyId === item.clientCompany.id ? '#eef2ff' : '#fff',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{item.clientCompany.name}</div>
                  <div className="muted small">
                    {item.role} · {item.summary.openTickets} заявок
                  </div>
                </div>

                <button
                  className="ghost"
                  type="button"
                  onClick={() => navigate(`/board?linkedClientCompanyId=${item.clientCompany.id}`)}
                >
                  Открыть
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {boardQ.isError ? <div className="alert">{(boardQ.error as any)?.message || String(boardQ.error)}</div> : null}

      <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <div className="muted small">Заявок сегодня</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{boardQ.isFetching ? '—' : stats.today}</div>
        </div>
        <div>
          <div className="muted small">Открытые заявки</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{boardQ.isFetching ? '—' : stats.open}</div>
        </div>
        <div>
          <div className="muted small">SLA нарушения</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{boardQ.isFetching ? '—' : stats.breachedByCol}</div>
          <div className="muted small" style={{ marginTop: 2 }}>под риском: {boardQ.isFetching ? '—' : stats.atRiskByCol}</div>
        </div>
        <div>
          <div className="muted small">Срочные</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{boardQ.isFetching ? '—' : stats.urgent}</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 0 }}>
          <div className="muted small">Пагинация</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              take
              <input style={{ width: 110 }} value={String(take)} onChange={(e) => setTake(Math.max(20, Math.min(1000, Number(e.target.value) || 0)))} />
            </label>
            <div className="muted small">Для демо можно увеличить take, например до 300.</div>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="panel">
          <h3 style={{ marginBottom: 6 }}>Заявок пока нет</h3>
          <div className="muted small" style={{ marginBottom: 10 }}>Создай тестовую заявку, чтобы доска стала живой для демонстрации.</div>
          <Link to="/tickets/new">
            <button>Создать заявку</button>
          </Link>
        </div>
      ) : null}

      <div className="kanban">
        {boardQ.isFetching ? (
          <>
            <ColumnSkeleton title="Новые" />
            <ColumnSkeleton title="Назначенные" />
            <ColumnSkeleton title="В работе" />
            <ColumnSkeleton title="Завершённые" />
            <ColumnSkeleton title="Отменённые" />
          </>
        ) : (
          columns.map((col) => (
            <div key={col.status} className="col">
              <div className="colhead">
                <div className="coltitle">{statusLabel(col.status)}</div>
                <div className="pill">{col.total}</div>
              </div>

              <div className="muted small" style={{ marginBottom: 8 }}>
                SLA: нарушено {col.sla.breached}, под риском {col.sla.atRisk}
              </div>

              <div className="cards">
                {col.cards.map((c) => (
                  <Link key={c.id} to={`/tickets/${c.id}`} style={{ textDecoration: 'none' }}>
                    <div className="ticket">
                      <div className="ticketTitle">{c.title}</div>

                      <div className="ticketMeta">
                        <UrgencyTag urgency={c.urgency} />
                        {c.slaBreached ? <span className="tag danger">SLA нарушен</span> : null}
                        {c.assignedTechnician ? <span className="tag">{c.assignedTechnician.email}</span> : <span className="tag">не назначено</span>}
                      </div>

                      <div className="muted small" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span>{fmt(c.createdAt)}</span>
                        <span title="Срок SLA">{c.slaDueAt ? `срок: ${fmt(c.slaDueAt)}` : 'срок: —'}</span>
                      </div>
                    </div>
                  </Link>
                ))}
                {col.cards.length === 0 ? <div className="muted small">Нет заявок</div> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}