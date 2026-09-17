import { useEffect, useRef, useState } from 'react'
import type * as api from '../../lib/api'
import type { TicketAvailableActionDescriptor, TicketAvailableActionKey } from '../../lib/ticketAvailableActions'

export type TicketActionsPanelProps = {
  ticket: api.TicketGetOne | null
  actions: TicketAvailableActionDescriptor[]
  runningActionKey?: TicketAvailableActionKey | null
  onRunAction: (key: TicketAvailableActionKey) => void
  actionError?: string | null
  canEditTicket: boolean
  editOpen: boolean
  onToggleEdit: () => void
  canCreateChildTicket: boolean
  showChildCreateForm: boolean
  childCreatePending: boolean
  onToggleChildCreateForm: () => void
  isTechnicianRole: boolean
}

export function TicketActionsPanel(props: TicketActionsPanelProps) {
  const {
    ticket,
    actions,
    runningActionKey,
    onRunAction,
    actionError,
    canEditTicket,
    editOpen,
    onToggleEdit,
    canCreateChildTicket,
    showChildCreateForm,
    childCreatePending,
    onToggleChildCreateForm,
    isTechnicianRole,
  } = props
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!ticket) return null

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="uiActions">
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            disabled={actions.length === 0}
          >
            Действия ▾
          </button>
          {open ? (
            <div
              role="menu"
              aria-label="Действия по заявке"
              style={{
                position: 'absolute',
                zIndex: 30,
                top: 'calc(100% + 6px)',
                left: 0,
                minWidth: 260,
                maxWidth: 360,
                display: 'grid',
                gap: 4,
                padding: 8,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
              }}
            >
              {actions.map((action) => {
                const disabled = !action.enabled || runningActionKey === action.key
                return (
                  <button
                    key={action.key}
                    type="button"
                    role="menuitem"
                    disabled={disabled}
                    className={action.danger ? 'ghost danger' : 'ghost'}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'grid',
                      gap: action.hint ? 2 : 0,
                      justifyItems: 'start',
                      opacity: disabled ? 0.72 : 1,
                    }}
                    onClick={() => {
                      if (!action.enabled) return
                      setOpen(false)
                      onRunAction(action.key)
                    }}
                  >
                    <span>{runningActionKey === action.key ? 'Выполняем…' : action.label}</span>
                    {action.hint ? <span className="muted small">{action.hint}</span> : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
        {canEditTicket && !isTechnicianRole ? (
          <button className="ghost" onClick={onToggleEdit}>
            {editOpen ? 'Скрыть редактирование' : 'Редактировать заявку'}
          </button>
        ) : null}
        {canCreateChildTicket && !isTechnicianRole ? (
          <button className="ghost" onClick={onToggleChildCreateForm} disabled={childCreatePending}>
            {showChildCreateForm ? 'Скрыть доп. работу' : '+ Ещё работа по этой точке'}
          </button>
        ) : null}
      </div>
      {actions.length === 0 ? <div className="muted small" style={{ marginTop: 8 }}>Доступных действий сейчас нет</div> : null}
      {actionError ? <div className="alert" style={{ marginTop: 10 }}>{actionError}</div> : null}
    </div>
  )
}
