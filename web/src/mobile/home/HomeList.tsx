import { type MutableRefObject, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import * as api from '../../lib/api'
import { mobileTicketCategoryLocationFromCard, mobileTicketNumberTitle } from '../mobileTicketDisplay'
import { mobileHomeTabEmptyCopy, type MobileHomeBoardFilterTab } from '../mobileHomeBoardFilters'
import { TicketCard } from './TicketCard'
import { getPrimaryActionLabel, homeTicketActionProgressLabel } from './utils'
import { formatMobileMutationError } from '../mobileActionErrors'
import { defaultExpandedLocationIds, groupTicketsByLocation, type MobileHomeLocationGroup } from '../mobileHomeListUtils'

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
  ticketLinkState: (ticket: api.TicketCard) => any
  onAction: (ticket: api.TicketCard) => void
  setAssignErr: (text: string) => void
  setAssignTicket: (ticket: api.TicketCard | null) => void
  assignCandidatesQ: UseQueryResult<any, unknown>
  assignTechOptions: api.AssignmentCandidateTechnician[]
  assignTechId: string
  setAssignTechId: (id: string) => void
  assignErr: string
  assignM: UseMutationResult<void, unknown, { ticketId: string; technicianId: string }, unknown>
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
      />
    )
  }

  return (
    <>
      <section className="mobileSection">
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
  return (
    <div className="mobileLocationGroup">
      <div
        className="mobileLocationGroupHeader"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        aria-expanded={expanded}
      >
        <div className="mobileLocationGroupInfo">
          <div className="mobileLocationGroupName">{group.locationName}</div>
          {(group.city || group.address) ? (
            <div className="mobileLocationGroupMeta">
              {[group.city, group.address].filter(Boolean).join(', ')}
            </div>
          ) : null}
          <div className="mobileLocationGroupStats">
            <span className="mobileLocationGroupStat mobileLocationGroupStat--total">
              Всего: {group.totalTickets}
            </span>
            <span className="mobileLocationGroupStat mobileLocationGroupStat--active">
              Активных: {group.activeTickets}
            </span>
            <span className="mobileLocationGroupStat mobileLocationGroupStat--done">
              Завершено: {group.doneTickets}
            </span>
            {group.canceledTickets > 0 ? (
              <span className="mobileLocationGroupStat mobileLocationGroupStat--canceled">
                Отменено: {group.canceledTickets}
              </span>
            ) : null}
            {group.overdueTickets > 0 ? (
              <span className="mobileLocationGroupStat mobileLocationGroupStat--overdue">
                Просрочено: {group.overdueTickets}
              </span>
            ) : null}
          </div>
        </div>
        <span className={`mobileLocationGroupChevron${expanded ? ' mobileLocationGroupChevron--open' : ''}`} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
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
  assignCandidatesQ: UseQueryResult<any, unknown>
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
                    {row.email}
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
              <button type="button" className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn" disabled={closeBusy} onClick={() => closeCameraInputRef.current?.click()}>
                Сделать фото отчёта
              </button>
              <button type="button" className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn" disabled={closeBusy} onClick={() => closeGalleryInputRef.current?.click()}>
                Выбрать фото из телефона
              </button>
            </div>
            {closeModal.previewUrl ? (
              <div className="mobilePhotoPreview">
                <img src={closeModal.previewUrl} alt={closeModal.file?.name || 'preview'} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }} />
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
              Комментарий не короче трёх символов. Сначала сохранится фото отчёта на заявку, затем она закроется.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
