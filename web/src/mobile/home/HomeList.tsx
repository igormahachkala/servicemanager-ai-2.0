import { type MutableRefObject } from 'react'
import { type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import * as api from '../../lib/api'
import { mobileTicketCategoryLocationFromCard, mobileTicketNumberTitle } from '../mobileTicketDisplay'
import { mobileHomeTabEmptyCopy, type MobileHomeBoardFilterTab } from '../mobileHomeBoardFilters'
import { TicketCard } from './TicketCard'
import { getPrimaryActionLabel, homeTicketActionProgressLabel } from './utils'

type CloseModalState = {
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
  tabCounts: Record<MobileHomeBoardFilterTab, number>
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
  closeModal: CloseModalState
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
  setCloseModal: (next: CloseModalState | ((prev: CloseModalState) => CloseModalState)) => void
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
    tabCounts,
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

  return (
    <>
      <section className="mobileSection">
        {homeActionErr ? <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 8 }}>{homeActionErr}</div> : null}
        {boardIsLoading ? (
          <div className="mobileCard mobileMeta">Загрузка заявок…</div>
        ) : tabOnlyTickets.length === 0 && !hasHomeListFilters ? (
          <TabEmpty boardTab={boardTab} role={role} boardTotal={boardTotal} tabCounts={tabCounts} />
        ) : visibleTickets.length === 0 ? (
          <FilteredEmpty filterSummary={filterSummary} onReset={resetHomeListFilters} />
        ) : (
          visibleTickets.map((ticket) => {
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
          })
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

      <CloseModal
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

function TabEmpty({
  boardTab,
  role,
  boardTotal,
  tabCounts,
}: {
  boardTab: MobileHomeBoardFilterTab
  role: api.Role | undefined
  boardTotal: number
  tabCounts: Record<MobileHomeBoardFilterTab, number>
}) {
  const empty = mobileHomeTabEmptyCopy(boardTab, {
    role,
    boardTotal,
    newUnassignedOnBoard: tabCounts.new,
  })
  return (
    <div className="mobileCard mobileEmptyState" role="status">
      <div className="mobileEmptyStateTitle">{empty.title}</div>
      <p className="mobileEmptyStateHint">{empty.hint}</p>
    </div>
  )
}

function FilteredEmpty({ filterSummary, onReset }: { filterSummary: string; onReset: () => void }) {
  return (
    <div className="mobileCard mobileEmptyState" role="status">
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
        {assignCandidatesQ.isError ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{(assignCandidatesQ.error as any)?.message || String(assignCandidatesQ.error)}</div> : null}
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

function CloseModal(props: {
  closeModal: CloseModalState
  closeBusy: boolean
  closeCameraInputRef: MutableRefObject<HTMLInputElement | null>
  closeGalleryInputRef: MutableRefObject<HTMLInputElement | null>
  setCloseModal: (next: CloseModalState | ((prev: CloseModalState) => CloseModalState)) => void
  closeCanSubmit: boolean
  closeM: UseMutationResult<void, unknown, void, unknown>
}) {
  const { closeModal, closeBusy, closeCameraInputRef, closeGalleryInputRef, setCloseModal, closeCanSubmit, closeM } = props
  if (!closeModal) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12 }}>
      <div className="mobileCard" style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
        <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 900 }}>Закрыть заявку</div>
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
              {closeBusy ? 'Завершаем…' : 'Завершить'}
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
