import { Link } from 'react-router-dom'
import type { TicketStatus, UpdateTicketStatusInput } from '../../lib/api'
import type { PrimaryTicketAction } from '../../lib/ticketOperationalModel'
import { TicketActionButton } from './TicketActionButton'
import { TicketActionErrors } from './TicketActionErrors'

export type TicketActionBarProps = {
  backToBoardHref: string
  primaryAction: PrimaryTicketAction | null
  canClaim: boolean
  canChangeStatus: boolean
  canTransitionTo: (s: TicketStatus) => boolean
  showCancel: boolean
  closeHint?: string | null
  claimPending: boolean
  statusPending: boolean
  newComment: string
  onNewCommentChange: (v: string) => void
  onAddComment: () => void
  addCommentPending: boolean
  onClaim: () => void
  /** 096: управленческое самоназначение, приходит из backend meta. */
  canAssignSelf?: boolean
  assignSelfPending?: boolean
  onAssignSelf?: () => void
  onSetStatus: (input: UpdateTicketStatusInput) => void
  /** Фото к заявке (не отчёт): открыть скрытый input */
  onPickOperationalPhoto: () => void
  operationalPhotoPending: boolean
  hasOperationalPhotoSelected: boolean
  claimError?: string | null
  statusError?: string | null
  onOpenSubmitForm?: () => void
}

export function TicketActionBar(props: TicketActionBarProps) {
  const {
    backToBoardHref,
    primaryAction,
    canClaim,
    canChangeStatus,
    canTransitionTo,
    showCancel,
    closeHint,
    claimPending,
    statusPending,
    newComment,
    onNewCommentChange,
    onAddComment,
    addCommentPending,
    onClaim,
    canAssignSelf,
    assignSelfPending,
    onAssignSelf,
    onSetStatus,
    onPickOperationalPhoto,
    operationalPhotoPending,
    hasOperationalPhotoSelected,
    claimError,
    statusError,
    onOpenSubmitForm,
  } = props

  const busy = claimPending || statusPending || addCommentPending || operationalPhotoPending

  return (
    <div className="ticketActionBarSticky">
      <div className="panel uiCard" style={{ marginBottom: 0, paddingBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Действия по заявке</div>

        {primaryAction ? (
          <div style={{ marginBottom: 10 }}>
            {primaryAction.kind === 'claim' ? (
              <TicketActionButton
                onClick={onClaim}
                disabled={claimPending || busy}
                style={{ width: '100%' }}
              >
                {claimPending ? 'Сохраняем…' : primaryAction.label}
              </TicketActionButton>
            ) : null}
            {primaryAction.kind === 'in_progress' ? (
              <TicketActionButton
                onClick={() => onSetStatus({ status: 'IN_PROGRESS' })}
                disabled={statusPending || busy || !canTransitionTo('IN_PROGRESS')}
                style={{ width: '100%' }}
              >
                {statusPending ? 'Сохраняем…' : primaryAction.label}
              </TicketActionButton>
            ) : null}
            {primaryAction.kind === 'done' ? (
              <TicketActionButton
                onClick={() => onOpenSubmitForm ? onOpenSubmitForm() : onSetStatus({ status: 'AWAITING_ACCEPTANCE', comment: newComment.trim() || undefined })}
                disabled={statusPending || busy || !canTransitionTo('AWAITING_ACCEPTANCE')}
                style={{ width: '100%' }}
              >
                {statusPending ? 'Сохраняем…' : primaryAction.label}
              </TicketActionButton>
            ) : null}
          </div>
        ) : null}

        <div className="ticketActionBarSecondary">
          <Link to={backToBoardHref} style={{ textDecoration: 'none' }}>
            <TicketActionButton variant="ghost" disabled={busy}>
              ← Доска
            </TicketActionButton>
          </Link>

          {canAssignSelf && onAssignSelf ? (
            <button className="ghost" data-testid="assign-self" onClick={onAssignSelf} disabled={!!assignSelfPending}>
              {assignSelfPending ? 'Назначаем…' : 'Назначить на себя'}
            </button>
          ) : null}
          {canClaim && primaryAction?.kind !== 'claim' ? (
            <TicketActionButton variant="ghost" onClick={onClaim} disabled={claimPending || busy}>
              {claimPending ? 'Забираем…' : 'Взять'}
            </TicketActionButton>
          ) : null}

          {canChangeStatus && primaryAction?.kind !== 'in_progress' ? (
            <TicketActionButton
              variant="ghost"
              disabled={statusPending || busy || !canTransitionTo('IN_PROGRESS')}
              onClick={() => onSetStatus({ status: 'IN_PROGRESS' })}
            >
              В работу
            </TicketActionButton>
          ) : null}

          {canChangeStatus && primaryAction?.kind !== 'done' && canTransitionTo('AWAITING_ACCEPTANCE') ? (
            <TicketActionButton
              variant="ghost"
              disabled={statusPending || busy}
              onClick={() => onOpenSubmitForm ? onOpenSubmitForm() : onSetStatus({ status: 'AWAITING_ACCEPTANCE', comment: newComment.trim() || undefined })}
            >
              Отправить на приёмку
            </TicketActionButton>
          ) : null}

          {showCancel ? (
            <TicketActionButton
              variant="ghost"
              disabled={statusPending || busy || !canTransitionTo('CANCELED')}
              onClick={() => onSetStatus({ status: 'CANCELED' })}
              title={closeHint || undefined}
            >
              Отменить
            </TicketActionButton>
          ) : null}

          <TicketActionButton variant="ghost" onClick={onPickOperationalPhoto} disabled={operationalPhotoPending || busy}>
            {operationalPhotoPending ? 'Загрузка…' : hasOperationalPhotoSelected ? 'Загрузить фото' : 'Фото'}
          </TicketActionButton>
        </div>

        {canChangeStatus ? (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <label className="muted small" style={{ display: 'grid', gap: 6 }}>
              Комментарий
              <textarea
                value={newComment}
                onChange={(e) => onNewCommentChange(e.target.value)}
                rows={2}
                placeholder="Кратко: что сделано / уточнение"
                disabled={addCommentPending || busy}
              />
            </label>
            <div>
              <TicketActionButton variant="ghost" onClick={onAddComment} disabled={addCommentPending || busy || !newComment.trim()}>
                {addCommentPending ? 'Сохраняем…' : 'Отправить комментарий'}
              </TicketActionButton>
            </div>
          </div>
        ) : null}


        <TicketActionErrors claimError={claimError} statusError={statusError} />
      </div>
    </div>
  )
}
