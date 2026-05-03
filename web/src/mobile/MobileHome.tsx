import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  compactTicketScope,
  mobileTicketCategoryLocationFromCard,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  type MobileTicketNavState,
  scopeForMobileTicketLink,
} from './mobileTicketDisplay'

function getPrimaryActionLabel(input: {
  ticket: api.TicketCard
  role?: api.Role | null
  claimableIds?: Set<string>
}): 'Взять' | 'Начать' | 'Закрыть' | null {
  const { ticket, role, claimableIds } = input
  const isTechnician = role === 'TECHNICIAN'
  const isFieldExecutor = api.isMobileFieldExecutorRole(role)

  if (ticket.status === 'NEW') {
    return isTechnician && claimableIds?.has(ticket.id) ? 'Взять' : null
  }
  if (ticket.status === 'ASSIGNED') return isFieldExecutor ? 'Начать' : null
  if (ticket.status === 'IN_PROGRESS') return isFieldExecutor ? 'Закрыть' : null
  return null
}

function assignedTechnicianDisplay(ticket: api.TicketCard): string {
  const t = ticket.assignedTechnician
  if (!t) return 'Не назначен'
  const email = (t.email || '').trim()
  if (email) return email
  return (t.id || '').trim() || 'Не назначен'
}

function TicketCard(props: {
  ticket: api.TicketCard
  ticketHref: string
  linkState?: MobileTicketNavState
  actionLabel?: 'Взять' | 'Начать' | 'Закрыть' | null
  onAction?: (ticket: api.TicketCard) => void
  actionPending?: boolean
  assignFooter?: { onOpen: () => void; disabled: boolean } | null
}) {
  const {
    ticket,
    ticketHref,
    linkState,
    actionLabel = null,
    onAction,
    actionPending = false,
    assignFooter = null,
  } = props
  return (
    <div className="mobileCard" style={{ padding: 0, overflow: 'hidden' }}>
      <Link to={ticketHref} state={linkState ?? mobileTicketNavState('home')} className="mobileCardClickable" style={{ borderRadius: 0 }}>
        <div style={{ padding: 12 }}>
          <div className="mobileRow">
            <strong>{mobileTicketNumberTitle(ticket.ticketNumber)}</strong>
            <span className="mobileMeta">{ticket.status}</span>
          </div>
          <div className="mobileMeta" style={{ marginTop: 4 }}>
            {mobileTicketCategoryLocationFromCard(ticket)}
          </div>
          <div className="mobileMeta" style={{ marginTop: 4 }}>
            Исполнитель: {assignedTechnicianDisplay(ticket)}
          </div>
        </div>
      </Link>
      {assignFooter ? (
        <div style={{ padding: '0 12px 12px' }}>
          <button
            type="button"
            className="mobileBtn mobileBtnSecondary"
            style={{ width: '100%' }}
            disabled={assignFooter.disabled}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              assignFooter.onOpen()
            }}
          >
            Назначить
          </button>
        </div>
      ) : null}
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
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
  const pageScope = {
    linkedClientCompanyId: linkedClientCompanyId || undefined,
    companyId: companyId || undefined,
  }
  const queryClient = useQueryClient()
  const boardQ = useQuery({
    queryKey: ['mobile-home-board', linkedClientCompanyId, companyId],
    queryFn: () =>
      api.board({
        linkedClientCompanyId: pageScope.linkedClientCompanyId,
        companyId: pageScope.companyId,
        take: 30,
      }),
    enabled: !!meQ.data,
  })
  const availableQ = useQuery({
    queryKey: ['mobile-home-available', linkedClientCompanyId],
    queryFn: () => api.availableTickets(linkedClientCompanyId || undefined),
    enabled: meQ.data?.role === 'TECHNICIAN',
  })

  const linkedClientsQ = useQuery({
    queryKey: ['mobile-home-linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: !!linkedClientCompanyId && !!meQ.data,
  })

  const cards = boardQ.data?.columns.flatMap((col) => col.cards || []) || []
  const inWork = cards.filter((card) => card.status === 'IN_PROGRESS' || card.status === 'ASSIGNED')
  const myTickets = cards.slice(0, 6)
  const available = (availableQ.data || []) as api.TicketCard[]
  const isTechnician = meQ.data?.role === 'TECHNICIAN'
  const canAssignProvider = api.isProviderTicketAssignRole(meQ.data?.role)
  const claimableIds = useMemo(() => new Set(available.map((ticket) => ticket.id)), [available])
  const technicianVisibleNew = useMemo(
    () => cards.filter((card) => card.status === 'NEW' && !card.assignedTechnician),
    [cards],
  )

  const [assignTicket, setAssignTicket] = useState<api.TicketCard | null>(null)
  const [assignTechId, setAssignTechId] = useState('')
  const [assignErr, setAssignErr] = useState('')

  const assignCandidatesQ = useQuery({
    queryKey: ['mobile-home-assign-candidates', assignTicket?.id, linkedClientCompanyId, companyId],
    queryFn: () => api.assignmentCandidates(assignTicket!.id, pageScope),
    enabled: !!assignTicket && canAssignProvider,
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

  const companyPrimaryLine = useMemo(() => {
    const fromMe = (meQ.data?.companyName || '').trim()
    if (fromMe) return fromMe
    return (api.getCompanyLabel(meQ.data) || '').trim() || '—'
  }, [meQ.data])

  const linkedClientDisplayName = useMemo(() => {
    if (!linkedClientCompanyId) return ''
    const row = linkedClientsQ.data?.find((x) => x.clientCompany.id === linkedClientCompanyId)
    return (row?.clientCompany?.name || '').trim()
  }, [linkedClientCompanyId, linkedClientsQ.data])

  const closeCameraInputRef = useRef<HTMLInputElement | null>(null)
  const closeGalleryInputRef = useRef<HTMLInputElement | null>(null)
  const [closeModal, setCloseModal] = useState<{
    ticketId: string
    title: string
    file: File | null
    previewUrl: string
    comment: string
    err: string
  } | null>(null)

  useEffect(() => {
    return () => {
      if (closeModal?.previewUrl) {
        URL.revokeObjectURL(closeModal.previewUrl)
      }
    }
  }, [closeModal?.previewUrl])

  const actionM = useMutation({
    mutationFn: async (ticket: api.TicketCard) => {
      if (ticket.status === 'NEW') {
        await api.claim(ticket.id, pageScope)
        return
      }
      if (ticket.status === 'ASSIGNED') {
        await api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, pageScope)
        return
      }
      if (ticket.status === 'IN_PROGRESS') {
        if (!api.isMobileFieldExecutorRole(meQ.data?.role)) {
          throw new Error('Закрытие доступно полевому исполнителю')
        }
        setCloseModal({
          ticketId: ticket.id,
          title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromCard(ticket)}`,
          file: null,
          previewUrl: '',
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
      if (!closeModal.file) throw new Error('Нужно фото отчёта')
      const comment = closeModal.comment.trim()
      if (comment.length < 3) throw new Error('Нужен короткий комментарий (backend требует комментарий для DONE)')

      await api.uploadTicketAttachment(closeModal.ticketId, closeModal.file, pageScope)
      await api.addTicketComment(closeModal.ticketId, comment, pageScope)
      await api.updateTicketStatus(closeModal.ticketId, { status: 'DONE' }, pageScope)
    },
    onSuccess: async () => {
      if (closeModal?.previewUrl) {
        URL.revokeObjectURL(closeModal.previewUrl)
      }
      setCloseModal(null)
      if (closeCameraInputRef.current) closeCameraInputRef.current.value = ''
      if (closeGalleryInputRef.current) closeGalleryInputRef.current.value = ''
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (e: any) => {
      setCloseModal((prev) => (prev ? { ...prev, err: e?.message || String(e) } : prev))
    },
  })

  const assignM = useMutation({
    mutationFn: async (params: { ticketId: string; technicianId: string }) => {
      await api.assignTicket(params.ticketId, params.technicianId, pageScope)
    },
    onMutate: () => {
      setAssignErr('')
    },
    onSuccess: async () => {
      setAssignTicket(null)
      setAssignTechId('')
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
    },
    onError: (e: any) => {
      setAssignErr(e?.message || String(e))
    },
  })

  const closeBusy = closeM.isPending
  const assignBusy = assignM.isPending

  const primaryPending = actionM.isPending || closeBusy || assignBusy

  const ticketHref = (ticket: api.TicketCard) => {
    if (!meQ.data) return `/m/tickets/${ticket.id}`
    const linkScope = scopeForMobileTicketLink(meQ.data, pageScope, ticket)
    return api.appendScopeToPath(`/m/tickets/${ticket.id}`, compactTicketScope(linkScope), meQ.data)
  }

  const ticketLinkState = (ticket: api.TicketCard) => mobileTicketNavState('home', ticket.companyId)

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
        <div className="mobileMeta">
          <div>
            <span className="mobileContextLabel">Компания:</span> {companyPrimaryLine}
          </div>
          {linkedClientCompanyId ? (
            <div style={{ marginTop: 6 }}>
              <span className="mobileContextLabel">Клиент:</span> {linkedClientDisplayName || '—'}
            </div>
          ) : null}
        </div>
        <Link
          to={api.appendScopeToPath('/m/create', pageScope, meQ.data)}
          className="mobileBtn mobileCreateTicketLink"
        >
          Создать заявку
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
                  ticketHref={ticketHref(ticket)}
                  linkState={ticketLinkState(ticket)}
                  actionLabel={getPrimaryActionLabel({ ticket, role: meQ.data?.role, claimableIds })}
                  actionPending={primaryPending}
                  onAction={(next) => actionM.mutate(next)}
                />
              ))
            )}
          </section>

          <section className="mobileSection">
            <h2 className="mobileSectionTitle">Доступные</h2>
            {technicianVisibleNew.length === 0 ? (
              <div className="mobileCard mobileMeta">Нет доступных заявок</div>
            ) : (
              technicianVisibleNew.slice(0, 4).map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  ticketHref={ticketHref(ticket)}
                  linkState={ticketLinkState(ticket)}
                  actionLabel={getPrimaryActionLabel({ ticket, role: meQ.data?.role, claimableIds })}
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
                .map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    ticketHref={ticketHref(ticket)}
                    linkState={ticketLinkState(ticket)}
                    actionLabel={getPrimaryActionLabel({ ticket, role: meQ.data?.role, claimableIds })}
                    actionPending={primaryPending}
                    onAction={(next) => actionM.mutate(next)}
                  />
                ))
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
                .map((ticket) => {
                  const showAssignFooter =
                    canAssignProvider && ticket.status === 'NEW' && !ticket.assignedTechnician
                  return (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      ticketHref={ticketHref(ticket)}
                      linkState={ticketLinkState(ticket)}
                      assignFooter={
                        showAssignFooter
                          ? {
                              onOpen: () => {
                                setAssignErr('')
                                setAssignTicket(ticket)
                              },
                              disabled: primaryPending,
                            }
                          : null
                      }
                    />
                  )
                })
            )}
          </section>
        </>
      )}

      {assignTicket ? (
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
                  {mobileTicketNumberTitle(assignTicket.ticketNumber)} · {mobileTicketCategoryLocationFromCard(assignTicket)}
                </div>
              </div>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary"
                disabled={assignBusy}
                onClick={() => {
                  setAssignTicket(null)
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
                  <select
                    value={assignTechId}
                    disabled={assignBusy}
                    onChange={(e) => setAssignTechId(e.target.value)}
                  >
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
                    onClick={() =>
                      assignM.mutate({ ticketId: assignTicket.id, technicianId: assignTechId })
                    }
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
                  if (closeModal?.previewUrl) {
                    URL.revokeObjectURL(closeModal.previewUrl)
                  }
                  setCloseModal(null)
                  if (closeCameraInputRef.current) closeCameraInputRef.current.value = ''
                  if (closeGalleryInputRef.current) closeGalleryInputRef.current.value = ''
                }}
              >
                Отмена
              </button>
            </div>

            {closeModal.err ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{closeModal.err}</div> : null}

            <div className="mobileForm" style={{ marginTop: 12 }}>
              <div className="mobilePhotoCardBlock">
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото отчёта *</div>
                <p className="mobileHint">Фото отчёта обязательно для закрытия заявки.</p>

                <input
                  ref={closeCameraInputRef}
                  className="mobileHiddenFileInput"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={closeBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setCloseModal((prev) => {
                      if (!prev) return prev
                      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
                      const previewUrl = file ? URL.createObjectURL(file) : ''
                      return { ...prev, file, previewUrl, err: '' }
                    })
                  }}
                />
                <input
                  ref={closeGalleryInputRef}
                  className="mobileHiddenFileInput"
                  type="file"
                  accept="image/*"
                  disabled={closeBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setCloseModal((prev) => {
                      if (!prev) return prev
                      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
                      const previewUrl = file ? URL.createObjectURL(file) : ''
                      return { ...prev, file, previewUrl, err: '' }
                    })
                  }}
                />

                <div className="mobilePhotoSourceRow">
                  <button
                    type="button"
                    className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                    disabled={closeBusy}
                    onClick={() => closeCameraInputRef.current?.click()}
                  >
                    Сделать фото отчёта
                  </button>
                  <button
                    type="button"
                    className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                    disabled={closeBusy}
                    onClick={() => closeGalleryInputRef.current?.click()}
                  >
                    Выбрать фото из телефона
                  </button>
                </div>

                {closeModal.previewUrl ? (
                  <div className="mobilePhotoPreview">
                    <img
                      src={closeModal.previewUrl}
                      alt={closeModal.file?.name || 'preview'}
                      style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }}
                    />
                  </div>
                ) : null}
                {closeModal.file ? <div className="mobileMeta" style={{ marginTop: 10 }}>Файл: {closeModal.file.name}</div> : null}
              </div>

              <label className="mobileFormFieldAfterPhoto">
                Комментарий к закрытию *
                <textarea
                  rows={3}
                  value={closeModal.comment}
                  disabled={closeBusy}
                  placeholder="Коротко: что сделали / результат"
                  onChange={(e) => setCloseModal((prev) => (prev ? { ...prev, comment: e.target.value, err: '' } : prev))}
                />
              </label>

              <div className="mobileFormSubmitStack">
                <button type="button" className="mobileBtn" disabled={!closeCanSubmit} onClick={() => closeM.mutate()}>
                  {closeBusy ? 'Закрываем...' : 'Загрузить отчёт и закрыть'}
                </button>
                <p className="mobileHint" style={{ marginBottom: 0 }}>
                  Комментарий не короче трёх символов. Сначала сохранится фото отчёта на заявку, затем она закроется.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
