import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  mobileTicketCategoryLocationFromDetail,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  type MobileTicketListOrigin,
  type MobileTicketNavState,
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
  const raw = (location.state as MobileTicketNavState | null)?.mobileListOrigin
  if (raw === 'my') return 'my'
  return 'home'
}

function isImageAttachment(a: api.TicketAttachmentItem) {
  return (a.mimeType || '').toLowerCase().startsWith('image/')
}

function isCommentTimelineItem(item: api.TimelineItem): boolean {
  const c = typeof item.payload?.comment === 'string' ? item.payload.comment.trim() : ''
  if (c.length > 0) return true
  const t = `${item.type || ''} ${item.timelineEvent || ''} ${item.domainType || ''}`.toLowerCase()
  return t.includes('comment')
}

export function MobileTicketDetails() {
  const { id } = useParams()
  const ticketId = id || ''
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const navState = location.state as MobileTicketNavState | null | undefined

  const observerCompanyId = useMemo(
    () => (searchParams.get('companyId') || api.getObserverCompanyId(meQ.data)).trim(),
    [searchParams, meQ.data],
  )

  const linkedClientCompanyId = useMemo(() => {
    const q = (searchParams.get('linkedClientCompanyId') || '').trim()
    if (q) return q
    const fromNav = (navState?.ticketOwnerCompanyId || '').trim()
    if (fromNav) return fromNav
    return (api.getLinkedClientCompanyId(meQ.data) || '').trim()
  }, [searchParams, navState?.ticketOwnerCompanyId, meQ.data])

  const [autoLinkedClientCompanyId, setAutoLinkedClientCompanyId] = useState('')
  const effectiveLinkedClientCompanyId = linkedClientCompanyId || autoLinkedClientCompanyId

  const scopeNorm = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: effectiveLinkedClientCompanyId || undefined,
    }),
    [observerCompanyId, effectiveLinkedClientCompanyId],
  )

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

  const inferredLinkedClientCompanyId = useMemo(() => {
    if (effectiveLinkedClientCompanyId) return effectiveLinkedClientCompanyId
    if (observerCompanyId) return ''
    if (ticketQ.data?.meta?.visibilityMode !== 'provider_primary') return ''
    return ticketQ.data?.meta?.scopeCompanyId || ''
  }, [effectiveLinkedClientCompanyId, observerCompanyId, ticketQ.data?.meta?.visibilityMode, ticketQ.data?.meta?.scopeCompanyId])

  const effectiveTicketScope = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: inferredLinkedClientCompanyId || undefined,
    }),
    [observerCompanyId, inferredLinkedClientCompanyId],
  )

  const attachmentsQ = useQuery({
    enabled: !!ticketId && !!ticketQ.data,
    queryKey: ['mobile-ticket-attachments', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: () => api.ticketAttachments(ticketId, effectiveTicketScope),
  })

  const timelineQ = useQuery({
    enabled: !!ticketId && !!ticketQ.data,
    queryKey: ['mobile-ticket-timeline', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: () => api.timeline(ticketId, effectiveTicketScope),
  })

  const listOrigin = readListOrigin(location)
  const backPath = listOrigin === 'my' ? '/m/my' : '/m'
  const backHref = api.appendScopeToPath(backPath, scopeNorm, meQ.data)

  const ticket = ticketQ.data
  const ticketCompanyId = (ticket as { companyId?: string } | undefined)?.companyId?.trim() || ''

  const childHref = (childId: string) =>
    api.appendScopeToPath(`/m/tickets/${childId}`, scopeNorm, meQ.data)

  const desc = ticket ? `${ticket.problemText || ''}`.trim() || ticket.description?.trim() || '—' : '—'

  const timelineItems = timelineQ.data?.timeline || timelineQ.data?.items || []
  const commentItems = useMemo(() => timelineItems.filter(isCommentTimelineItem), [timelineItems])

  const requestImages = useMemo(() => {
    const imgs = (attachmentsQ.data || []).filter(isImageAttachment)
    return imgs.filter((a) => a.purpose !== 'WORK_REPORT')
  }, [attachmentsQ.data])

  const reportImages = useMemo(() => {
    const imgs = (attachmentsQ.data || []).filter(isImageAttachment)
    return imgs.filter((a) => a.purpose === 'WORK_REPORT')
  }, [attachmentsQ.data])

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

          <div className="mobileCard" style={{ marginTop: 8 }}>
            {attachmentsQ.isLoading ? <div className="mobileMeta">Загрузка вложений…</div> : null}
            {attachmentsQ.isError ? (
              <div className="mobileNotice mobileNoticeError">{String((attachmentsQ.error as any)?.message || attachmentsQ.error)}</div>
            ) : null}
            {!attachmentsQ.isLoading && !attachmentsQ.isError ? (
              <>
                <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>
                  Фото заявки
                </div>
                {requestImages.length === 0 ? (
                  <div className="mobileMeta">Нет фото</div>
                ) : (
                  <div className="mobilePhotoGrid">
                    {requestImages.map((a) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="mobilePhotoThumbLink">
                        <img src={a.url} alt="" className="mobilePhotoThumb" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="mobileSectionTitle" style={{ marginTop: 14, marginBottom: 8 }}>
                  Фото отчёта
                </div>
                {reportImages.length === 0 ? (
                  <div className="mobileMeta">Нет фото отчёта</div>
                ) : (
                  <div className="mobilePhotoGrid">
                    {reportImages.map((a) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="mobilePhotoThumbLink">
                        <img src={a.url} alt="" className="mobilePhotoThumb" />
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div className="mobileCard" style={{ marginTop: 8 }}>
            <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>
              Комментарии
            </div>
            {timelineQ.isLoading ? <div className="mobileMeta">Загрузка…</div> : null}
            {!timelineQ.isLoading && (timelineQ.isError || commentItems.length === 0) ? (
              <div className="mobileMeta">Комментариев пока нет</div>
            ) : null}
            {!timelineQ.isLoading && !timelineQ.isError && commentItems.length > 0 ? (
              <div className="mobileSection" style={{ gap: 10 }}>
                {commentItems.map((item, idx) => {
                  const text =
                    typeof item.payload?.comment === 'string' && item.payload.comment.trim()
                      ? item.payload.comment.trim()
                      : item.title || '—'
                  const who = item.actor?.email || '—'
                  return (
                    <div key={`${item.at}-${idx}`} style={{ borderTop: idx ? '1px solid #e5e7eb' : undefined, paddingTop: idx ? 10 : 0 }}>
                      <div className="mobileMeta">{who}</div>
                      <div style={{ marginTop: 4, fontSize: '0.92rem', whiteSpace: 'pre-wrap' }}>{text}</div>
                      <div className="mobileMeta" style={{ marginTop: 4 }}>
                        {item.at}
                      </div>
                    </div>
                  )
                })}
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
                    state={mobileTicketNavState(
                      listOrigin,
                      [navState?.ticketOwnerCompanyId, ticketCompanyId, inferredLinkedClientCompanyId, linkedClientCompanyId]
                        .map((x) => (x || '').trim())
                        .find((x) => x.length > 0),
                    )}
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
