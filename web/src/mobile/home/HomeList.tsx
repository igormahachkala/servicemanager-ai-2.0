import { type MutableRefObject, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import * as api from '../../lib/api'
import { mobileTicketCategoryLocationFromCard, mobileTicketNumberTitle, type MobileTicketNavState } from '../mobileTicketDisplay'
import { mobileHomeTabEmptyCopy, type MobileHomeBoardFilterTab } from '../mobileHomeBoardFilters'
import { TicketCard } from './TicketCard'
import { getPrimaryActionLabel, homeTicketActionProgressLabel } from './utils'
import { formatMobileMutationError } from '../mobileActionErrors'
import { defaultExpandedLocationIds, groupTicketsByLocation, type MobileHomeLocationGroup } from '../mobileHomeListUtils'
import { compactIdentityLabel, presentActorIdentity } from '../../lib/ticketActorIdentity'
import {
  TICKET_MEDIA_ACCEPT,
  normalizeTicketMediaFile,
  ticketMediaKind,
  validateTicketMediaFile,
} from '../../lib/ticketAttachmentMedia'

export type TicketCloseModalState = {
  ticketId: string
  title: string
  file: File | null
  previewUrl: string
  comment: string
  err: string
} | null

type Props = {
  boardIsLoading: boolean
  visibleTickets: api.TicketCard[]
  tabOnlyTickets: api.TicketCard[]
  boardTab: MobileHomeBoardFilterTab
  role: api.Role | undefined
  meId: string | undefined
  boardTotal: number
  hasHomeListFilters: boolean
  filterSummary: string
  homeActionErr: string
  resetHomeListFilters: () => void
  canAssignProvider: boolean
  actionM: UseMutationResult<void, unknown, api.TicketCard, unknown>
  closeBusy: boolean
  closeModal: TicketCloseModalState
  assignBusy: boolean
  assignTicket: api.TicketCard | null
  ticketHref: (ticket: api.TicketCard) => string
  ticketLinkState: (ticket: api.TicketCard) => MobileTicketNavState
  onAction: (ticket: api.TicketCard) => void
  setAssignErr: (text: string) => void
  setAssignTicket: (ticket: api.TicketCard | null) => void
  assignCandidatesQ: UseQueryResult<api.AssignmentCandidatesResponse, unknown>
  assignTechOptions: api.AssignmentCandidateTechnician[]
  assignTechId: string
  setAssignTechId: (id: string) => void
  assignErr: string
  assignM: UseMutationResult<void, unknown, { ticketId: string; technicianId: string }, unknown>
  canAcceptOnCard: boolean
  acceptM: UseMutationResult<void, unknown, api.TicketCard, unknown>
  onAccept: (ticket: api.TicketCard) => void
  closeCameraInputRef: MutableRefObject<HTMLInputElement | null>
  closeGalleryInputRef: MutableRefObject<HTMLInputElement | null>
  setCloseModal: (next: TicketCloseModalState | ((prev: TicketCloseModalState) => TicketCloseModalState)) => void
  closeCanSubmit: boolean
  closeM: UseMutationResult<void, unknown, void, unknown>
  mobileActionToast: string
}

export function HomeList(props: Props) {
  const {
    boardIsLoading,
    visibleTickets,
    tabOnlyTickets,
    boardTab,
    role,
    meId,
    boardTotal,
    hasHomeListFilters,
    filterSummary,
    homeActionErr,
    resetHomeListFilters,
    canAssignProvider,
    actionM,
    closeBusy,
    closeModal,
    assignBusy,
    assignTicket,
    ticketHref,
    ticketLinkState,
    onAction,
    setAssignErr,
    setAssignTicket,
    assignCandidatesQ,
    assignTechOptions,
    assignTechId,
    setAssignTechId,
    assignErr,
    assignM,
    canAcceptOnCard,
    acceptM,
    onAccept,
    closeCameraInputRef,
    closeGalleryInputRef,
    setCloseModal,
    closeCanSubmit,
    closeM,
    mobileActionToast,
  } = props

  const groups = useMemo(() => groupTicketsByLocation(visibleTickets), [visibleTickets])

  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(() => defaultExpandedLocationIds(groups))

  const prevGroupKeyRef = useRef('')
  useEffect(() => {
    const key = groups.map((g) => g.locationId).join('\x00')
    if (key === prevGroupKeyRef.current) return
    prevGroupKeyRef.current = key
    setExpandedLocations(defaultExpandedLocationIds(groups))
  }, [groups])

  function toggleLocation(locationId: string) {
    setExpandedLocations((prev) => {
      const next = new Set(prev)
      if (next.has(locationId)) next.delete(locationId)
      else next.add(locationId)
      return next
    })
  }

  function renderTicket(ticket: api.TicketCard) {
    const showAssignFooter = canAssignProvider && ticket.status === 'NEW' && !ticket.assignedTechnician
    const actionProgressLabel = homeTicketActionProgressLabel(
      ticket,
      actionM,
      closeBusy,
      closeModal?.ticketId,
      assignBusy,
      assignTicket?.id,
    )
    const cardBusy = !!actionProgressLabel || (assignBusy && assignTicket?.id === ticket.id && showAssignFooter)
    const showAcceptFooter = canAcceptOnCard && ticket.status === 'AWAITING_ACCEPTANCE'
    return (
      <TicketCard
        key={ticket.id}
        ticket={ticket}
        ticketHref={ticketHref(ticket)}
        linkState={ticketLinkState(ticket)}
        actionLabel={getPrimaryActionLabel(ticket, meId, role)}
        actionProgressLabel={actionProgressLabel}
        onAction={onAction}
        assignFooter={
          showAssignFooter
            ? {
                onOpen: () => {
                  setAssignErr('')
                  setAssignTicket(ticket)
                },
                disabled: cardBusy,
              }
            : null
        }
        acceptFooter={
          showAcceptFooter
            ? { onAccept: () => onAccept(ticket), busy: acceptM.isPending && acceptM.variables?.id === ticket.id }
            : null
        }
      />
    )
  }

  return (
    <>
      <section className="mobileSection" data-mobile-tour="ticket-list">
        {homeActionErr ? <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 8 }}>{homeActionErr}</div> : null}
        {boardIsLoading ? (
          <div className="mobileCard mobileMeta">Загрузка заявок…</div>
        ) : tabOnlyTickets.length === 0 && !hasHomeListFilters ? (
          <TabEmpty boardTab={boardTab} role={role} boardTotal={boardTotal} />
        ) : visibleTickets.length === 0 ? (
          <FilteredEmpty filterSummary={filterSummary} onReset={resetHomeListFilters} />
        ) : (
          groups.map((group) => (
            <LocationGroupCard
              key={group.locationId}
              group={group}
              expanded={expandedLocations.has(group.locationId)}
              onToggle={() => toggleLocation(group.locationId)}
              renderTicket={renderTicket}
            />
          ))
        )}
      </section>

      <AssignModal
        assignTicket={assignTicket}
        assignBusy={assignBusy}
        setAssignTicket={setAssignTicket}
        assignCandidatesQ={assignCandidatesQ}
        assignErr={assignErr}
        assignTechOptions={assignTechOptions}
        assignTechId={assignTechId}
        setAssignTechId={setAssignTechId}
        onAssign={() => assignTicket && assignM.mutate({ ticketId: assignTicket.id, technicianId: assignTechId })}
      />

      <TicketCloseModal
        closeModal={closeModal}
        closeBusy={closeBusy}
        closeCameraInputRef={closeCameraInputRef}
        closeGalleryInputRef={closeGalleryInputRef}
        setCloseModal={setCloseModal}
        closeCanSubmit={closeCanSubmit}
        closeM={closeM}
      />

      {mobileActionToast ? (
        <div className="mobileToastHost" role="status">
          <div className="mobileToast">{mobileActionToast}</div>
        </div>
      ) : null}
    </>
  )
}

function LocationGroupCard({
  group,
  expanded,
  onToggle,
  renderTicket,
}: {
  group: MobileHomeLocationGroup
  expanded: boolean
  onToggle: () => void
  renderTicket: (ticket: api.TicketCard) => ReactNode
}) {
  // Разбивка активных заявок точки по статусам — чистая производная от group.tickets
  // (там только активные), без изменения логики группировки/фильтрации/пагинации.
  const assignedCount = group.tickets.filter((t) => t.status === 'ASSIGNED').length
  const inWorkCount = group.tickets.filter((t) => t.status === 'IN_PROGRESS').length
  const awaitingCount = group.tickets.filter((t) => t.status === 'AWAITING_ACCEPTANCE').length
  const hasOverdue = group.overdueTickets > 0
  const statCells: { label: string; value: number; tone: string }[] = [
    { label: 'Новые', value: group.newTickets, tone: 'new' },
    { label: 'Назначены', value: assignedCount, tone: 'assigned' },
    { label: 'В работе', value: inWorkCount, tone: 'inwork' },
    { label: 'Приёмка', value: awaitingCount, tone: 'awaiting' },
    { label: 'Просроч.', value: group.overdueTickets, tone: 'overdue' },
  ]

  return (
    <div className={`mobileLocationGroup${hasOverdue ? ' mobileLocationGroup--overdue' : ''}`}>
      <div
        className="mobileLocationGroupHeader"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        aria-expanded={expanded}
      >
        <span className={`mobileLocationGroupIcon${hasOverdue ? ' mobileLocationGroupIcon--overdue' : ''}`} aria-hidden>
          {/* Tabler building */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" />
            <path d="M5 21V7l8-4v18" />
            <path d="M19 21V11l-6-4" />
            <line x1="9" y1="9" x2="9" y2="9.01" />
            <line x1="9" y1="12" x2="9" y2="12.01" />
            <line x1="9" y1="15" x2="9" y2="15.01" />
          </svg>
        </span>
        <div className="mobileLocationGroupInfo">
          <div className="mobileLocationGroupTitleRow">
            <div className="mobileLocationGroupName">{group.locationName}</div>
            <div className="mobileLocationGroupHeaderRight">
              {group.activeTickets > 0 ? (
                <span className="mobileLocationGroupBadge">{group.activeTickets}</span>
              ) : null}
              <span className={`mobileLocationGroupChevron${expanded ? ' mobileLocationGroupChevron--open' : ''}`} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
          </div>
          {(group.city || group.address) ? (
            <div className="mobileLocationGroupMeta">
              {[group.city, group.address].filter(Boolean).join(', ')}
            </div>
          ) : null}
          <div className="mobileLocationGroupStatGrid">
            {statCells.map((cell) => (
              <div
                key={cell.label}
                className={`mobileLocationGroupStatCell mobileLocationGroupStatCell--${cell.tone}${cell.value === 0 ? ' mobileLocationGroupStatCell--off' : ''}`}
              >
                <span className="mobileLocationGroupStatCellValue">{cell.value}</span>
                <span className="mobileLocationGroupStatCellLabel">{cell.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {expanded ? (
        <div className="mobileLocationGroupTickets">
          {group.tickets.length > 0 ? (
            group.tickets.map((t) => renderTicket(t))
          ) : (
            <div className="mobileLocationGroupEmptyActive mobileMeta">Нет активных заявок</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function TabEmpty({
  boardTab,
  role,
  boardTotal,
}: {
  boardTab: MobileHomeBoardFilterTab
  role: api.Role | undefined
  boardTotal: number
}) {
  const empty = mobileHomeTabEmptyCopy(boardTab, {
    role,
    boardTotal,
  })
  return (
    <div className="mobileCard mobileEmptyState" role="status">
      <span className="mobileEmptyStateIcon" aria-hidden>
        {/* Tabler inbox */}
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 13h3l3 3h4l3-3h3" />
          <path d="M4 13v-4l2 -5h12l2 5v4" />
          <path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-5" />
        </svg>
      </span>
      <div className="mobileEmptyStateTitle">{empty.title}</div>
      <p className="mobileEmptyStateHint">{empty.hint}</p>
    </div>
  )
}

function FilteredEmpty({ filterSummary, onReset }: { filterSummary: string; onReset: () => void }) {
  return (
    <div className="mobileCard mobileEmptyState" role="status">
      <span className="mobileEmptyStateIcon" aria-hidden>
        {/* Tabler search */}
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="7" />
          <line x1="21" y1="21" x2="15" y2="15" />
        </svg>
      </span>
      <div className="mobileEmptyStateTitle">Ничего не найдено</div>
      <p className="mobileEmptyStateHint">Активные условия: {filterSummary || '—'}</p>
      <button type="button" className="mobileBtn mobileBtnSecondary" onClick={onReset}>Сбросить фильтры</button>
    </div>
  )
}

function AssignModal(props: {
  assignTicket: api.TicketCard | null
  assignBusy: boolean
  setAssignTicket: (ticket: api.TicketCard | null) => void
  assignCandidatesQ: UseQueryResult<api.AssignmentCandidatesResponse, unknown>
  assignErr: string
  assignTechOptions: api.AssignmentCandidateTechnician[]
  assignTechId: string
  setAssignTechId: (id: string) => void
  onAssign: () => void
}) {
  const { assignTicket, assignBusy, setAssignTicket, assignCandidatesQ, assignErr, assignTechOptions, assignTechId, setAssignTechId, onAssign } = props
  if (!assignTicket) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.55)', zIndex: 62, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12 }}>
      <div className="mobileCard" style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
        <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 900 }}>Назначить исполнителя</div>
            <div className="mobileMeta" style={{ marginTop: 4 }}>
              {mobileTicketNumberTitle(assignTicket.ticketNumber)} · {mobileTicketCategoryLocationFromCard(assignTicket)}
            </div>
          </div>
          <button type="button" className="mobileBtn mobileBtnSecondary" disabled={assignBusy} onClick={() => setAssignTicket(null)}>Отмена</button>
        </div>
        {assignCandidatesQ.isLoading ? <div className="mobileMeta" style={{ marginTop: 12 }}>Загружаем список техников…</div> : null}
        {assignCandidatesQ.isError ? (
          <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>
            {formatMobileMutationError(assignCandidatesQ.error, { operation: 'assign_candidates' })}
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
                    {compactIdentityLabel(presentActorIdentity(row, { roleFallback: 'Исполнитель' }))}
                    {row.matched ? ' · рекомендован' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="mobileFormSubmitStack" style={{ marginTop: 12 }}>
              <button type="button" className="mobileBtn" disabled={!assignTechId || assignBusy || assignCandidatesQ.isLoading} onClick={onAssign}>
                {assignBusy ? 'Назначаем…' : 'Назначить'}
              </button>
            </div>
          </div>
        ) : null}
        {!assignCandidatesQ.isLoading && assignCandidatesQ.data && assignTechOptions.length === 0 ? (
          <div className="mobileMeta" style={{ marginTop: 12 }}>Нет доступных техников для назначения.</div>
        ) : null}
      </div>
    </div>
  )
}

export function TicketCloseModal(props: {
  closeModal: TicketCloseModalState
  closeBusy: boolean
  closeCameraInputRef: MutableRefObject<HTMLInputElement | null>
  closeGalleryInputRef: MutableRefObject<HTMLInputElement | null>
  setCloseModal: (next: TicketCloseModalState | ((prev: TicketCloseModalState) => TicketCloseModalState)) => void
  closeCanSubmit: boolean
  closeM: UseMutationResult<void, unknown, void, unknown>
  /** SMA-ACCEPTANCE-005: переопределение текстов для сценария «Отправить на приёмку». */
  heading?: string
  submitLabel?: string
  submitBusyLabel?: string
}) {
  const { closeModal, closeBusy, closeCameraInputRef, closeGalleryInputRef, setCloseModal, closeCanSubmit, closeM } = props
  const heading = props.heading ?? 'Закрыть заявку'
  const submitLabel = props.submitLabel ?? 'Завершить'
  const submitBusyLabel = props.submitBusyLabel ?? 'Завершаем…'
  if (!closeModal) return null
  const setReportFile = (rawFile: File | null) => {
    const file = rawFile ? normalizeTicketMediaFile(rawFile) : null
    const validationError = file ? validateTicketMediaFile(file) : null
    setCloseModal((prev) => {
      if (!prev) return prev
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      if (validationError) return { ...prev, file: null, previewUrl: '', err: validationError }
      return { ...prev, file, previewUrl: file ? URL.createObjectURL(file) : '', err: '' }
    })
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12 }}>
      <div className="mobileCard" style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
        <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 900 }}>{heading}</div>
            <div className="mobileMeta" style={{ marginTop: 4 }}>{closeModal.title}</div>
          </div>
          <button
            type="button"
            className="mobileBtn mobileBtnSecondary"
            disabled={closeBusy}
            onClick={() => {
              if (closeModal.previewUrl) URL.revokeObjectURL(closeModal.previewUrl)
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
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото или видео отчёта *</div>
            <p className="mobileHint">Фото или видео результата обязательно для завершения заявки.</p>
            <input
              ref={closeCameraInputRef}
              className="mobileHiddenFileInput"
              type="file"
              accept={TICKET_MEDIA_ACCEPT}
              capture="environment"
              disabled={closeBusy}
              onChange={(e) => {
                setReportFile(e.target.files?.[0] || null)
              }}
            />
            <input
              ref={closeGalleryInputRef}
              className="mobileHiddenFileInput"
              type="file"
              accept={TICKET_MEDIA_ACCEPT}
              disabled={closeBusy}
              onChange={(e) => {
                setReportFile(e.target.files?.[0] || null)
              }}
            />
            <div className="mobilePhotoSourceRow">
              <button type="button" className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn" disabled={closeBusy} onClick={() => closeCameraInputRef.current?.click()}>
                Снять фото/видео отчёта
              </button>
              <button type="button" className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn" disabled={closeBusy} onClick={() => closeGalleryInputRef.current?.click()}>
                Выбрать файл из телефона
              </button>
            </div>
            {closeModal.previewUrl ? (
              <div className="mobilePhotoPreview">
                {ticketMediaKind(closeModal.file || {}) === 'video' ? (
                  <video src={closeModal.previewUrl} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 320, borderRadius: 12, border: '1px solid #e5e7eb', background: '#111827' }} />
                ) : (
                  <img src={closeModal.previewUrl} alt={closeModal.file?.name || 'preview'} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                )}
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
            <button type="button" className="mobileBtn mobileBtn--done" disabled={!closeCanSubmit} onClick={() => closeM.mutate()}>
              {closeBusy ? submitBusyLabel : submitLabel}
            </button>
            <p className="mobileHint" style={{ marginBottom: 0 }}>
              Комментарий не короче трёх символов. Сначала сохранится медиаотчёт, затем заявка перейдёт дальше по процессу.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
