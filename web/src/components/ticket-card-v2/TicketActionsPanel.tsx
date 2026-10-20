import { TicketActionBar } from '../ticket-page/TicketActionBar'
import type * as api from '../../lib/api'
import type { PrimaryTicketAction } from '../../lib/ticketOperationalModel'

export type TicketActionsPanelProps = {
  showTechnicianActionBar: boolean
  ticket: api.TicketGetOne | null
  backToBoardHref: string
  primaryAction: PrimaryTicketAction | null
  canClaim: boolean
  canChangeStatus: boolean
  canTransitionTo: (status: api.TicketStatus) => boolean
  showCancelInTechnicianBar: boolean
  technicianBarCloseHint?: string | null
  claimPending: boolean
  statusPending: boolean
  newComment: string
  onNewCommentChange: (value: string) => void
  onAddComment: () => void
  addCommentPending: boolean
  onClaim: () => void
  onSetStatus: (input: api.UpdateTicketStatusInput) => void
  onPickOperationalPhoto: () => void
  operationalPhotoPending: boolean
  hasOperationalPhotoSelected: boolean
  claimError?: string | null
  statusError?: string | null
  onOpenSubmitForm?: () => void
  showSelfAssign: boolean
  selfAssignPending: boolean
  onSelfAssign: () => void
  canEditTicket: boolean
  editOpen: boolean
  onToggleEdit: () => void
  canCreateChildTicket: boolean
  showChildCreateForm: boolean
  childCreatePending: boolean
  onToggleChildCreateForm: () => void
  isTechnicianRole: boolean
  onShowSubmitForm: () => void
}

export function TicketActionsPanel(props: TicketActionsPanelProps) {
  const {
    showTechnicianActionBar,
    ticket,
    backToBoardHref,
    primaryAction,
    canClaim,
    canChangeStatus,
    canTransitionTo,
    showCancelInTechnicianBar,
    technicianBarCloseHint,
    claimPending,
    statusPending,
    newComment,
    onNewCommentChange,
    onAddComment,
    addCommentPending,
    onClaim,
    onSetStatus,
    onPickOperationalPhoto,
    operationalPhotoPending,
    hasOperationalPhotoSelected,
    claimError,
    statusError,
    onOpenSubmitForm,
    showSelfAssign,
    selfAssignPending,
    onSelfAssign,
    canEditTicket,
    editOpen,
    onToggleEdit,
    canCreateChildTicket,
    showChildCreateForm,
    childCreatePending,
    onToggleChildCreateForm,
    isTechnicianRole,
    onShowSubmitForm,
  } = props

  if (!ticket) return null

  if (showTechnicianActionBar) {
    return (
      <div style={{ marginBottom: 12 }}>
        <TicketActionBar
          backToBoardHref={backToBoardHref}
          primaryAction={primaryAction}
          canClaim={canClaim}
          canChangeStatus={canChangeStatus}
          canTransitionTo={canTransitionTo}
          showCancel={showCancelInTechnicianBar}
          closeHint={technicianBarCloseHint}
          claimPending={claimPending}
          statusPending={statusPending}
          newComment={newComment}
          onNewCommentChange={onNewCommentChange}
          onAddComment={onAddComment}
          addCommentPending={addCommentPending}
          onClaim={onClaim}
          onSetStatus={onSetStatus}
          onPickOperationalPhoto={onPickOperationalPhoto}
          operationalPhotoPending={operationalPhotoPending}
          hasOperationalPhotoSelected={hasOperationalPhotoSelected}
          claimError={claimError}
          statusError={statusError}
          onOpenSubmitForm={onOpenSubmitForm}
        />
      </div>
    )
  }

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Действия</h3>
      {showSelfAssign ? (
        <div style={{ marginBottom: 8 }}>
          <button onClick={onSelfAssign} disabled={selfAssignPending} style={{ width: '100%' }}>
            {selfAssignPending ? 'Берём заявку…' : 'Взять заявку себе'}
          </button>
        </div>
      ) : null}
      {primaryAction ? (
        <div style={{ marginBottom: 8 }}>
          {primaryAction.kind === 'claim' ? (
            <button onClick={onClaim} disabled={claimPending} style={{ width: '100%' }}>
              {claimPending ? 'Сохраняем…' : primaryAction.label}
            </button>
          ) : null}
          {primaryAction.kind === 'in_progress' ? (
            <button onClick={() => onSetStatus({ status: 'IN_PROGRESS' })} disabled={statusPending || !canTransitionTo('IN_PROGRESS')} style={{ width: '100%' }}>
              {statusPending ? 'Сохраняем…' : primaryAction.label}
            </button>
          ) : null}
          {primaryAction.kind === 'done' ? (
            <button onClick={onShowSubmitForm} disabled={!canTransitionTo('AWAITING_ACCEPTANCE')} style={{ width: '100%' }}>
              {primaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="uiActions">
        <a href={backToBoardHref} style={{ textDecoration: 'none' }}>
          <button className="ghost">← Назад к доске</button>
        </a>
        {canEditTicket && !isTechnicianRole ? (
          <button className="ghost" onClick={onToggleEdit}>
            {editOpen ? 'Скрыть редактирование' : 'Редактировать заявку'}
          </button>
        ) : null}
        {canClaim && primaryAction?.kind !== 'claim' ? (
          <button className="ghost" onClick={onClaim} disabled={claimPending}>
            {claimPending ? 'Забираем…' : 'Взять заявку'}
          </button>
        ) : null}
        {canChangeStatus ? (
          <>
            {primaryAction?.kind !== 'in_progress' && ticket.status !== 'AWAITING_ACCEPTANCE' ? (
              <button className="ghost" disabled={statusPending || !canTransitionTo('IN_PROGRESS')} onClick={() => onSetStatus({ status: 'IN_PROGRESS' })}>
                {statusPending ? 'Сохраняем…' : 'В работу'}
              </button>
            ) : null}
            {primaryAction?.kind !== 'done' && canTransitionTo('AWAITING_ACCEPTANCE') ? (
              <button className="ghost" onClick={onShowSubmitForm}>
                Отправить на приёмку
              </button>
            ) : null}
            {!isTechnicianRole ? (
              <button className="ghost" disabled={statusPending || !canTransitionTo('CANCELED')} onClick={() => onSetStatus({ status: 'CANCELED' })}>
                {statusPending ? 'Сохраняем…' : 'Отменить'}
              </button>
            ) : null}
          </>
        ) : null}
        {canCreateChildTicket && !isTechnicianRole ? (
          <button className="ghost" onClick={onToggleChildCreateForm} disabled={childCreatePending}>
            {showChildCreateForm ? 'Скрыть доп. работу' : '+ Ещё работа по этой точке'}
          </button>
        ) : null}
      </div>
      {(claimError || statusError) ? <div className="alert" style={{ marginTop: 10 }}>{claimError || statusError}</div> : null}
    </div>
  )
}
