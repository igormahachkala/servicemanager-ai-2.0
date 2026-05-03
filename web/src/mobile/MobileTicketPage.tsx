import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  mobileTicketCategoryLocationFromDetail,
  mobileTicketDetailGetOneScopes,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  mobileTicketPriorityIsUrgent,
  mobileTicketSlaCountdownLabel,
  mobileTicketStatusLabelRu,
  type MobileTicketListOrigin,
  type MobileTicketNavState,
} from './mobileTicketDisplay'
import {
  getOnlineStatus,
  loadAnyTicketDetailCache,
  loadTicketDetailCache,
  saveTicketDetailCache,
  useOnlineStatus,
} from './offlineQueue'

function readListOrigin(location: ReturnType<typeof useLocation>): MobileTicketListOrigin {
  const raw = (location.state as MobileTicketNavState | null)?.mobileListOrigin
  if (raw === 'my') return 'my'
  return 'home'
}

function isImageAttachment(a: api.TicketAttachmentItem) {
  return (a.mimeType || '').toLowerCase().startsWith('image/')
}

function ticketAttachmentLabel(a: api.TicketAttachmentItem) {
  const fn = (a.filename || '').trim()
  if (fn) return fn
  return (a.originalName || '').trim() || 'Вложение'
}

function isReportTicketImage(a: api.TicketAttachmentItem) {
  return a.purpose === 'WORK_REPORT'
}

function MobileTicketAttachmentThumb({ attachment }: { attachment: api.TicketAttachmentItem }) {
  const [broken, setBroken] = useState(false)
  const resolved = api.resolveTicketAttachmentUrl(attachment)
  const label = ticketAttachmentLabel(attachment)

  if (!resolved || broken) {
    return (
      <div className="mobilePhotoUnavailable">
        <div className="mobilePhotoUnavailableName">{label}</div>
        <div className="mobilePhotoUnavailableHint">Фото недоступно</div>
      </div>
    )
  }

  return (
    <a href={resolved} target="_blank" rel="noreferrer" className="mobilePhotoThumbLink">
      <img
        src={resolved}
        alt={label}
        className="mobilePhotoThumb"
        loading="lazy"
        onError={() => setBroken(true)}
      />
    </a>
  )
}

function isCommentTimelineItem(item: api.TimelineItem): boolean {
  const c = typeof item.payload?.comment === 'string' ? item.payload.comment.trim() : ''
  if (c.length > 0) return true
  const t = `${item.type || ''} ${item.timelineEvent || ''} ${item.domainType || ''}`.toLowerCase()
  return t.includes('comment')
}

function isNotFoundGetTicketError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\b404\b/i.test(msg) || /not\s*found/i.test(msg) || /не\s+найден/i.test(msg)
}

function formatAddressBlock(ticket: api.TicketGetOne): string {
  const loc = ticket.location
  const parts: string[] = []
  const name = (loc?.name || ticket.pointName || '').trim()
  if (name) parts.push(name)
  const addr = (loc?.address || ticket.address || '').trim()
  if (addr) parts.push(addr)
  const city = (loc?.city || '').trim()
  if (city && !parts.join(' ').includes(city)) parts.push(city)
  return parts.length ? parts.join(' · ') : '—'
}

export function MobileTicketPage() {
  const { id } = useParams()
  const ticketId = id || ''
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const queryClient = useQueryClient()

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

  const ticketOwnerNav = (navState?.ticketOwnerCompanyId || '').trim()

  const scopeNorm = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: linkedClientCompanyId || undefined,
    }),
    [observerCompanyId, linkedClientCompanyId],
  )

  useEffect(() => {
    api.persistScopeFromSearchParams(searchParams, meQ.data)
  }, [searchParams, meQ.data])

  const isOnline = useOnlineStatus()

  const ticketQ = useQuery({
    enabled: !!ticketId,
    queryKey: [
      'mobile-ticket-detail',
      ticketId,
      observerCompanyId,
      linkedClientCompanyId,
      ticketOwnerNav,
      meQ.data?.id,
      meQ.data?.role,
    ],
    queryFn: async () => {
      if (!ticketId) throw new Error('Нет идентификатора заявки')

      if (!getOnlineStatus()) {
        const cached = loadTicketDetailCache(ticketId, scopeNorm) ?? loadAnyTicketDetailCache(ticketId)
        if (cached?.data?.ticket) return cached.data.ticket
        throw new Error('Нет сохранённой заявки. Откройте заявку при подключении к сети хотя бы раз.')
      }

      const urlCo = (searchParams.get('companyId') || '').trim()
      const urlLi = (searchParams.get('linkedClientCompanyId') || '').trim()
      const persistedObs = (api.getObserverCompanyId(meQ.data) || '').trim()
      const persistedLinked = (api.getLinkedClientCompanyId(meQ.data) || '').trim()

      const scopes = mobileTicketDetailGetOneScopes({
        urlCompanyId: urlCo,
        urlLinkedClientCompanyId: urlLi,
        stateTicketOwnerCompanyId: ticketOwnerNav,
        persistedCompanyId: persistedObs,
        persistedLinkedClientCompanyId: persistedLinked,
        meRole: meQ.data?.role,
      })

      let lastErr: unknown
      for (const sc of scopes) {
        try {
          return await api.getTicket(ticketId, sc)
        } catch (e) {
          lastErr = e
          if (!isNotFoundGetTicketError(e)) throw e
        }
      }

      if (!urlLi) {
        try {
          const co = await api.company()
          if (co.type === 'PROVIDER') {
            const linkedClients = await api.getLinkedClients()
            for (const lc of linkedClients) {
              const clientId = (lc.clientCompany.id || '').trim()
              if (!clientId) continue
              if (scopes.some((s) => (s.linkedClientCompanyId || '').trim() === clientId)) continue
              try {
                return await api.getTicket(ticketId, { linkedClientCompanyId: clientId })
              } catch (e) {
                lastErr = e
                if (!isNotFoundGetTicketError(e)) throw e
              }
            }
          }
        } catch (e) {
          if (!isNotFoundGetTicketError(e)) throw e
        }
      }

      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'Заявка не найдена'))
    },
  })

  const inferredLinkedClientCompanyId = useMemo(() => {
    if (linkedClientCompanyId) return linkedClientCompanyId
    if (observerCompanyId) return ''
    if (ticketQ.data?.meta?.visibilityMode !== 'provider_primary') return ''
    return ticketQ.data?.meta?.scopeCompanyId || ''
  }, [linkedClientCompanyId, observerCompanyId, ticketQ.data?.meta?.visibilityMode, ticketQ.data?.meta?.scopeCompanyId])

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
    queryFn: async () => {
      if (!getOnlineStatus()) {
        const cached = loadTicketDetailCache(ticketId, scopeNorm) ?? loadAnyTicketDetailCache(ticketId)
        if (cached?.data) return cached.data.attachments
        throw new Error('Нет сохранённых вложений для офлайна.')
      }
      return api.ticketAttachments(ticketId, effectiveTicketScope)
    },
  })

  const timelineQ = useQuery({
    enabled: !!ticketId && !!ticketQ.data,
    queryKey: ['mobile-ticket-timeline', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: async () => {
      if (!getOnlineStatus()) {
        const cached = loadTicketDetailCache(ticketId, scopeNorm) ?? loadAnyTicketDetailCache(ticketId)
        if (cached?.data) return cached.data.timeline ?? null
        throw new Error('Нет сохранённой истории для офлайна.')
      }
      return api.timeline(ticketId, effectiveTicketScope)
    },
  })

  useEffect(() => {
    if (!getOnlineStatus()) return
    if (!ticketQ.isSuccess || !ticketId || !ticketQ.data) return
    if (!attachmentsQ.isSuccess) return
    if (timelineQ.isError) return
    if (!timelineQ.isFetched) return
    saveTicketDetailCache({
      ticketId,
      scope: effectiveTicketScope,
      ticket: ticketQ.data,
      attachments: attachmentsQ.data ?? [],
      timeline: timelineQ.data ?? null,
    })
  }, [
    ticketId,
    effectiveTicketScope.companyId,
    effectiveTicketScope.linkedClientCompanyId,
    ticketQ.isSuccess,
    ticketQ.data,
    attachmentsQ.isSuccess,
    attachmentsQ.data,
    timelineQ.isFetched,
    timelineQ.isError,
    timelineQ.data,
  ])

  const ticket = ticketQ.data
  const canAssignProvider = api.isProviderTicketAssignRole(meQ.data?.role)
  const techPrimary = ticket && meQ.data?.id ? api.mobileTechnicianTicketPrimaryAction(ticket, meQ.data.id) : null

  const [assignTicketOpen, setAssignTicketOpen] = useState(false)
  const [assignTechId, setAssignTechId] = useState('')
  const [assignErr, setAssignErr] = useState('')

  const assignCandidatesQ = useQuery({
    queryKey: ['mobile-ticket-assign-candidates', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: () => api.assignmentCandidates(ticketId, effectiveTicketScope),
    enabled: !!ticketId && !!ticket && assignTicketOpen && canAssignProvider,
  })

  const assignTechOptions = useMemo(() => {
    const d = assignCandidatesQ.data
    if (!d) return []
    const seen = new Set<string>()
    const out: api.AssignmentCandidateTechnician[] = []
    for (const row of [...d.matched, ...d.others]) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
    }
    return out
  }, [assignCandidatesQ.data])

  useEffect(() => {
    if (!assignTechOptions.length) {
      setAssignTechId('')
      return
    }
    setAssignTechId((prev) => {
      if (prev && assignTechOptions.some((r) => r.id === prev)) return prev
      return assignTechOptions[0]!.id
    })
  }, [assignTechOptions])

  const invalidateTicketQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-attachments'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-timeline'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
    await queryClient.invalidateQueries({ queryKey: ['board'] })
  }

  const techActionM = useMutation({
    mutationFn: async (mode: 'claim' | 'start') => {
      if (!ticket) throw new Error('Нет заявки')
      if (mode === 'claim') await api.claim(ticket.id, effectiveTicketScope)
      else await api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, effectiveTicketScope)
    },
    onSuccess: async () => {
      await invalidateTicketQueries()
    },
  })

  const assignM = useMutation({
    mutationFn: async (params: { technicianId: string }) => {
      if (!ticketId) throw new Error('Нет заявки')
      await api.assignTicket(ticketId, params.technicianId, effectiveTicketScope)
    },
    onMutate: () => setAssignErr(''),
    onSuccess: async () => {
      setAssignTicketOpen(false)
      setAssignTechId('')
      await invalidateTicketQueries()
    },
    onError: (e: any) => {
      setAssignErr(e?.message || String(e))
    },
  })

  const listOrigin = readListOrigin(location)
  const backPath = listOrigin === 'my' ? '/m/my' : '/m'
  const backHref = api.appendScopeToPath(backPath, scopeNorm, meQ.data)

  const ticketCompanyId = (ticket as { companyId?: string } | undefined)?.companyId?.trim() || ''

  const childHref = (childId: string) =>
    api.appendScopeToPath(`/m/tickets/${childId}`, scopeNorm, meQ.data)

  const desc = ticket ? `${ticket.problemText || ''}`.trim() || ticket.description?.trim() || '—' : '—'

  const timelineItems = timelineQ.data?.timeline || timelineQ.data?.items || []
  const commentItems = useMemo(() => timelineItems.filter(isCommentTimelineItem), [timelineItems])

  const requestImages = useMemo(() => {
    const imgs = (attachmentsQ.data || []).filter(isImageAttachment)
    return imgs.filter((a) => !isReportTicketImage(a))
  }, [attachmentsQ.data])

  const reportImages = useMemo(() => {
    const imgs = (attachmentsQ.data || []).filter(isImageAttachment)
    return imgs.filter((a) => isReportTicketImage(a))
  }, [attachmentsQ.data])

  const otherFiles = useMemo(() => (attachmentsQ.data || []).filter((a) => !isImageAttachment(a)), [attachmentsQ.data])

  const executorLine = ticket
    ? (ticket.assignedTechnician?.email || '').trim() || 'Не назначен'
    : '—'

  const showAssignButton =
    !!ticket &&
    canAssignProvider &&
    ticket.status === 'NEW' &&
    !ticket.assignedTechnicianId &&
    !ticket.assignedTechnician

  const showTechnicianInProgressHint =
    !!ticket &&
    meQ.data?.role === 'TECHNICIAN' &&
    ticket.status === 'IN_PROGRESS' &&
    ticket.assignedTechnicianId === meQ.data?.id

  const techActionBusy = techActionM.isPending
  const assignBusy = assignM.isPending

  return (
    <div className="mobileSection mobileTicketDetailsRoot">
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink">
          Назад
        </Link>
      </div>

      {!isOnline && ticketQ.isSuccess && ticket ? (
        <div className="mobileStaleDataBanner" role="status">
          Показаны сохранённые данные
        </div>
      ) : null}

      {ticketQ.isLoading ? <div className="mobileCard mobileMeta">Загрузка…</div> : null}
      {ticketQ.isError ? (
        <div className="mobileNotice mobileNoticeError">{String((ticketQ.error as any)?.message || ticketQ.error)}</div>
      ) : null}

      {ticket ? (
        <>
          <div
            className={[
              'mobileCard',
              'mobileTicketCard',
              `mobileTicketCard--${ticket.status}`,
              ticket.status !== 'DONE' &&
              ticket.status !== 'CANCELED' &&
              (ticket.slaBreachedAt ||
                (ticket.slaDueAt && !Number.isNaN(new Date(ticket.slaDueAt).getTime()) && Date.now() > new Date(ticket.slaDueAt).getTime()))
                ? 'mobileTicketCardSlaOverdue'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="mobileTicketDetailsHeadline">{mobileTicketNumberTitle(ticket.ticketNumber)}</div>
            <div className="mobileRow" style={{ marginTop: 8 }}>
              <span className="mobileMeta">ID</span>
              <span style={{ fontSize: '0.78rem', textAlign: 'right', wordBreak: 'break-all' }}>{ticket.id}</span>
            </div>
            <div className="mobileMeta" style={{ marginTop: 8 }}>
              {mobileTicketCategoryLocationFromDetail(ticket)}
            </div>
            <div className="mobileRow" style={{ marginTop: 12 }}>
              <span className="mobileMeta">Статус</span>
              <span className={`mobileTicketStatus mobileTicketStatus--${ticket.status}`}>{mobileTicketStatusLabelRu(ticket.status)}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="mobileMeta" style={{ marginBottom: 4 }}>
                SLA
              </div>
              <div style={{ fontSize: '0.92rem', lineHeight: 1.5 }}>
                {mobileTicketPriorityIsUrgent(ticket.priority ?? 'NORMAL') ? (
                  <span className="mobileSlaUrgentPill" style={{ marginRight: 8 }}>
                    Срочно
                  </span>
                ) : null}
                <span>Приоритет: {ticket.priority === 'URGENT' ? 'срочный ответ (2 ч)' : 'обычный (24 ч)'}</span>
                {ticket.slaDueAt ? (
                  <div style={{ marginTop: 6 }}>
                    Дедлайн:{' '}
                    {new Date(ticket.slaDueAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                ) : null}
                {(() => {
                  const line = mobileTicketSlaCountdownLabel({
                    slaDueAt: ticket.slaDueAt,
                    slaBreached: !!ticket.slaBreachedAt || (ticket.slaDueAt ? Date.now() > new Date(ticket.slaDueAt).getTime() : false),
                    status: ticket.status,
                  })
                  return line ? <div style={{ marginTop: 4 }}>{line}</div> : null
                })()}
              </div>
            </div>
            <div className="mobileRow" style={{ marginTop: 10 }}>
              <span className="mobileMeta">Категория</span>
              <strong style={{ textAlign: 'right', fontSize: '0.9rem' }}>{ticket.problemCategory?.name || '—'}</strong>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="mobileMeta" style={{ marginBottom: 4 }}>
                Локация / адрес
              </div>
              <div style={{ fontSize: '0.95rem', lineHeight: 1.45 }}>{formatAddressBlock(ticket)}</div>
            </div>
            <div className="mobileRow" style={{ marginTop: 12 }}>
              <span className="mobileMeta">Исполнитель</span>
              <strong style={{ textAlign: 'right', fontSize: '0.9rem' }}>{executorLine}</strong>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="mobileMeta" style={{ marginBottom: 6 }}>
                Описание
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.45 }}>{desc}</div>
            </div>
          </div>

          {(techPrimary || showAssignButton || showTechnicianInProgressHint) && (
            <div className="mobileCard" style={{ marginTop: 8 }}>
              <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>
                Действия
              </div>
              {meQ.data?.role === 'TECHNICIAN' && techPrimary === 'claim' ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtn--claim"
                  style={{ width: '100%' }}
                  disabled={techActionBusy}
                  onClick={() => techActionM.mutate('claim')}
                >
                  {techActionBusy ? 'Выполняем…' : 'Взять заявку'}
                </button>
              ) : null}
              {meQ.data?.role === 'TECHNICIAN' && techPrimary === 'start' ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtn--start"
                  style={{ width: '100%' }}
                  disabled={techActionBusy}
                  onClick={() => techActionM.mutate('start')}
                >
                  {techActionBusy ? 'Выполняем…' : 'Начать работу'}
                </button>
              ) : null}
              {showTechnicianInProgressHint ? (
                <div className="mobileMeta" style={{ marginTop: 8 }}>
                  Закрытие с фото отчёта — на вкладке «Главная» в списке «В работе».
                </div>
              ) : null}
              {showAssignButton ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtnSecondary"
                  style={{ width: '100%', marginTop: techPrimary ? 8 : 0 }}
                  onClick={() => {
                    setAssignErr('')
                    setAssignTicketOpen(true)
                  }}
                >
                  Назначить исполнителя
                </button>
              ) : null}
            </div>
          )}

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
                      <MobileTicketAttachmentThumb key={a.id} attachment={a} />
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
                      <MobileTicketAttachmentThumb key={a.id} attachment={a} />
                    ))}
                  </div>
                )}
                {otherFiles.length > 0 ? (
                  <>
                    <div className="mobileSectionTitle" style={{ marginTop: 14, marginBottom: 8 }}>
                      Другие вложения
                    </div>
                    <ul className="mobileMeta" style={{ margin: 0, paddingLeft: 18 }}>
                      {otherFiles.map((a) => {
                        const href = api.resolveTicketAttachmentUrl(a)
                        return (
                          <li key={a.id} style={{ marginBottom: 6 }}>
                            {href ? (
                              <a href={href} target="_blank" rel="noreferrer">
                                {ticketAttachmentLabel(a)}
                              </a>
                            ) : (
                              ticketAttachmentLabel(a)
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </>
                ) : null}
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
                    className={`mobileCard mobileTicketCard mobileTicketCard--${ch.status} mobileCardClickable`}
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
                    <div style={{ marginTop: 4 }}>
                      <span className={`mobileTicketStatus mobileTicketStatus--${ch.status}`}>{mobileTicketStatusLabelRu(ch.status)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {assignTicketOpen && ticket ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 24, 39, 0.55)',
            zIndex: 62,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <div className="mobileCard" style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
            <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 900 }}>Назначить исполнителя</div>
                <div className="mobileMeta" style={{ marginTop: 4 }}>
                  {mobileTicketNumberTitle(ticket.ticketNumber)}
                </div>
              </div>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary"
                disabled={assignBusy}
                onClick={() => {
                  setAssignTicketOpen(false)
                  setAssignErr('')
                }}
              >
                Отмена
              </button>
            </div>
            {assignCandidatesQ.isLoading ? (
              <div className="mobileMeta" style={{ marginTop: 12 }}>
                Загружаем список техников…
              </div>
            ) : null}
            {assignCandidatesQ.isError ? (
              <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>
                {(assignCandidatesQ.error as any)?.message || String(assignCandidatesQ.error)}
              </div>
            ) : null}
            {assignErr ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{assignErr}</div> : null}
            {assignCandidatesQ.data && assignTechOptions.length > 0 ? (
              <div className="mobileForm" style={{ marginTop: 12 }}>
                <label className="mobileFormFieldAfterPhoto">
                  Техник
                  <select value={assignTechId} disabled={assignBusy} onChange={(e) => setAssignTechId(e.target.value)}>
                    {assignTechOptions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.email}
                        {row.matched ? ' · рекомендован' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mobileFormSubmitStack" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="mobileBtn"
                    disabled={!assignTechId || assignBusy || assignCandidatesQ.isLoading}
                    onClick={() => assignM.mutate({ technicianId: assignTechId })}
                  >
                    {assignBusy ? 'Назначаем…' : 'Назначить'}
                  </button>
                </div>
              </div>
            ) : null}
            {!assignCandidatesQ.isLoading && assignCandidatesQ.data && assignTechOptions.length === 0 ? (
              <div className="mobileMeta" style={{ marginTop: 12 }}>
                Нет доступных техников для назначения.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
