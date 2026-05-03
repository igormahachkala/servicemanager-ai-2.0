import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  mobileTicketCategoryLocationFromDetail,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  type MobileTicketListOrigin,
} from './mobileTicketDisplay'

function statusLabel(status: api.TicketStatus) {
  if (status === 'NEW') return 'Новая'
  if (status === 'ASSIGNED') return 'Назначена'
  if (status === 'IN_PROGRESS') return 'В работе'
  if (status === 'DONE') return 'Завершена'
  if (status === 'CANCELED') return 'Отменена'
  return status
}

function readListOrigin(location: ReturnType<typeof useLocation>): MobileTicketListOrigin {
  const raw = (location.state as { mobileListOrigin?: string } | null)?.mobileListOrigin
  if (raw === 'my') return 'my'
  return 'home'
}

export function MobileTicketDetails() {
  const { id } = useParams()
  const ticketId = id || ''
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const observerCompanyId = (searchParams.get('companyId') || api.getObserverCompanyId()).trim()
  const linkedClientCompanyId = (searchParams.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
  const [autoLinkedClientCompanyId, setAutoLinkedClientCompanyId] = useState('')
  const effectiveLinkedClientCompanyId = linkedClientCompanyId || autoLinkedClientCompanyId

  const scopeNorm = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: effectiveLinkedClientCompanyId || undefined,
    }),
    [observerCompanyId, effectiveLinkedClientCompanyId],
  )

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  useEffect(() => {
    api.persistScopeFromSearchParams(searchParams, meQ.data)
  }, [searchParams, meQ.data])

  const ownCompanyQ = useQuery({
    queryKey: ['mobile-ticket-own-company'],
    queryFn: () => api.company(),
    enabled: !observerCompanyId && !linkedClientCompanyId,
  })
  const linkedClientsQ = useQuery({
    queryKey: ['mobile-ticket-linked-clients-fallback'],
    queryFn: api.getLinkedClients,
    enabled: !observerCompanyId && !linkedClientCompanyId && ownCompanyQ.data?.type === 'PROVIDER',
  })

  const ticketQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['mobile-ticket-detail', ticketId, observerCompanyId, effectiveLinkedClientCompanyId],
    queryFn: () => api.getTicket(ticketId, scopeNorm),
  })

  useEffect(() => {
    if (!ticketId) return
    if (observerCompanyId || linkedClientCompanyId || autoLinkedClientCompanyId) return
    if (ownCompanyQ.data?.type !== 'PROVIDER') return
    if (!ticketQ.isError) return
    const linkedClients = linkedClientsQ.data || []
    if (!linkedClients.length) return

    let cancelled = false
    ;(async () => {
      for (const linkedClient of linkedClients) {
        try {
          await api.getTicket(ticketId, { linkedClientCompanyId: linkedClient.clientCompany.id })
          if (!cancelled) {
            setAutoLinkedClientCompanyId(linkedClient.clientCompany.id)
          }
          return
        } catch {
          // try next linked client scope
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    ticketId,
    observerCompanyId,
    linkedClientCompanyId,
    autoLinkedClientCompanyId,
    ownCompanyQ.data?.type,
    ticketQ.isError,
    linkedClientsQ.data,
  ])

  const listOrigin = readListOrigin(location)
  const backPath = listOrigin === 'my' ? '/m/my' : '/m'
  const backHref = api.appendScopeToPath(backPath, scopeNorm, meQ.data)

  const childHref = (childId: string) =>
    api.appendScopeToPath(`/m/tickets/${childId}`, scopeNorm, meQ.data)

  const ticket = ticketQ.data
  const desc = ticket ? `${ticket.problemText || ''}`.trim() || ticket.description?.trim() || '—' : '—'

  return (
    <div className="mobileSection mobileTicketDetailsRoot">
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink">
          Назад
        </Link>
      </div>

      {ticketQ.isLoading ? <div className="mobileCard mobileMeta">Загрузка…</div> : null}
      {ticketQ.isError ? (
        <div className="mobileNotice mobileNoticeError">{String((ticketQ.error as any)?.message || ticketQ.error)}</div>
      ) : null}

      {ticket ? (
        <>
          <div className="mobileCard">
            <div className="mobileTicketDetailsHeadline">{mobileTicketNumberTitle(ticket.ticketNumber)}</div>
            <div className="mobileMeta" style={{ marginTop: 6 }}>
              {mobileTicketCategoryLocationFromDetail(ticket)}
            </div>
            <div className="mobileRow" style={{ marginTop: 12 }}>
              <span className="mobileMeta">Статус</span>
              <strong>{statusLabel(ticket.status)}</strong>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="mobileMeta" style={{ marginBottom: 6 }}>
                Описание
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.45 }}>{desc}</div>
            </div>
            {ticket.assignedTechnician?.email ? (
              <div className="mobileRow" style={{ marginTop: 12 }}>
                <span className="mobileMeta">Исполнитель</span>
                <strong style={{ textAlign: 'right', fontSize: '0.9rem' }}>{ticket.assignedTechnician.email}</strong>
              </div>
            ) : null}
          </div>

          {ticket.children?.length ? (
            <div className="mobileSection" style={{ marginTop: 4 }}>
              <h2 className="mobileSectionTitle">Связанные заявки</h2>
              {ticket.children.map((ch) => {
                const pc = ch.problemCategory
                const normalizedProblemCategory = {
                  id: pc?.id || '_',
                  name: pc?.name || 'Без категории',
                  instructions: (pc as { instructions?: string | null } | null | undefined)?.instructions ?? null,
                }
                return (
                  <Link
                    key={ch.id}
                    to={childHref(ch.id)}
                    state={mobileTicketNavState(listOrigin)}
                    className="mobileCard mobileCardClickable"
                    style={{ display: 'block', padding: 12 }}
                  >
                    <div className="mobileTicketDetailsHeadline">
                      {mobileTicketNumberTitle((ch as { ticketNumber?: number }).ticketNumber)}
                    </div>
                    <div className="mobileMeta" style={{ marginTop: 4 }}>
                      {mobileTicketCategoryLocationFromDetail({
                        problemCategory: normalizedProblemCategory,
                        title: ch.problemText || '',
                        location: ch.location ?? null,
                        pointName: null,
                      })}
                    </div>
                    <div className="mobileMeta" style={{ marginTop: 4 }}>
                      {statusLabel(ch.status)}
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
