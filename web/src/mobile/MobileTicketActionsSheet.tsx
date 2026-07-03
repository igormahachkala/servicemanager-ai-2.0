import { useEffect } from 'react'

export type TicketSheetAction = {
  id: string
  label: string
  icon: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  actions: TicketSheetAction[]
}

/**
 * Mobile-first bottom sheet с действиями над заявкой.
 * Презентационный: получает готовый список действий (wired в MobileTicketPage).
 * Закрытие по ✕, по фону и по Esc.
 */
export function MobileTicketActionsSheet({ open, onClose, actions }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="mobileSheetBackdrop" role="dialog" aria-modal="true" aria-label="Действия с заявкой" onClick={onClose}>
      <div className="mobileSheet" onClick={(e) => e.stopPropagation()}>
        <div className="mobileSheetGrip" aria-hidden />
        <div className="mobileSheetHeader">
          <span className="mobileSheetTitle">Действия с заявкой</span>
          <button type="button" className="mobileSheetClose" aria-label="Закрыть" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="mobileSheetActions">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`mobileSheetAction${a.danger ? ' mobileSheetAction--danger' : ''}`}
              disabled={a.disabled}
              onClick={() => {
                onClose()
                a.onClick()
              }}
            >
              <span className="mobileSheetActionIcon" aria-hidden>{a.icon}</span>
              <span className="mobileSheetActionLabel">{a.label}</span>
              <span className="mobileSheetActionChevron" aria-hidden>›</span>
            </button>
          ))}
        </div>
        <button type="button" className="mobileBtn mobileBtnSecondary mobileSheetCancel" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  )
}
