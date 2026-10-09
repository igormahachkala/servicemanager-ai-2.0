import { Link } from 'react-router-dom'
import * as api from '../../lib/api'
import { TicketClaimBlock } from './TicketClaimBlock'

type TicketHeaderProps = {
  ticket?: api.TicketGetOne
  ticketId: string
  isFetching: boolean
  observerCompanyId: string
  linkedClientCompanyId: string
  contextBadge: string
  backToBoardHref: string
  backToBoardState?: unknown
  canEditTicket: boolean
  editOpen: boolean
  onToggleEdit: () => void
  role?: api.Role | null
  meUserId?: string
  /** Подсказки claim: совпадает с доступом к кнопке на странице (учитывает режим видимости). */
  hintCanClaim: boolean
}

function parentTicketNumber(parent: NonNullable<api.TicketGetOne['parent']>): number | undefined {
  const n = (parent as { ticketNumber?: number }).ticketNumber
  return typeof n === 'number' ? n : undefined
}

function parentLinkLabel(parent: NonNullable<api.TicketGetOne['parent']>): string {
  const n = parentTicketNumber(parent)
  return n != null ? `Подзадача к заявке #${n}` : 'К родительской заявке'
}

export function TicketHeader(props: TicketHeaderProps) {
  const {
    ticket,
    ticketId,
    isFetching,
    observerCompanyId,
    linkedClientCompanyId,
    contextBadge,
    backToBoardHref,
    backToBoardState,
    canEditTicket,
    editOpen,
    onToggleEdit,
    role,
    meUserId,
    hintCanClaim,
  } = props
  const title = ticket?.ticketNumber != null ? `Заявка #${ticket.ticketNumber}` : 'Заявка'
  const parent = ticket?.parent ?? null
  const parentHref = parent
    ? api.appendScopeToPath(`/tickets/${parent.id}`, {
        companyId: observerCompanyId || undefined,
        linkedClientCompanyId: linkedClientCompanyId || undefined,
      })
    : null

  return (
    <>
      <div className="row">
        <div>
          <h2>{title}</h2>
          {parent && parentHref ? (
            <div className="muted small" style={{ marginTop: 4 }}>
              <Link to={parentHref}>{parentLinkLabel(parent)}</Link>
            </div>
          ) : null}
        </div>
        <div className="muted small">{isFetching && !ticket ? 'Загрузка…' : ticketId ? `ID: ${ticketId}` : '—'}</div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 0 }}>
          <div>
            <div className="muted small">Контекст доступа</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 12 }}>{contextBadge}</span>
              {observerCompanyId ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 12 }}>companyId: {observerCompanyId}</span> : null}
              {linkedClientCompanyId ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 12 }}>linkedClientCompanyId: {linkedClientCompanyId}</span> : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to={backToBoardHref} state={backToBoardState}>
              <button className="ghost">← Назад к доске</button>
            </Link>

            {canEditTicket ? (
              <button className="ghost" onClick={onToggleEdit}>
                {editOpen ? 'Скрыть редактирование' : 'Редактировать заявку'}
              </button>
            ) : null}
          </div>
        </div>
        <TicketClaimBlock
          role={role}
          canClaim={hintCanClaim}
          ticket={ticket}
          meUserId={meUserId}
        />
      </div>
    </>
  )
}
