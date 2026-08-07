import { useEffect, type ReactNode } from 'react'

export type TicketSheetAction = {
  id: string
  label: string
  /** Имя Tabler-иконки (см. SHEET_ICONS) — рендерится в inline SVG, не эмодзи. */
  icon: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

/** Tabler-иконки пунктов action-sheet заявки (по имени из TicketSheetAction.icon). */
const SHEET_ICONS: Record<string, ReactNode> = {
  'user-check': (<><path d="M6 21v-2a4 4 0 0 1 4 -4h3.5" /><circle cx="9" cy="7" r="4" /><path d="M15 19l2 2l4 -4" /></>),
  'user-plus': (<><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4" /><line x1="16" y1="11" x2="22" y2="11" /><line x1="19" y1="8" x2="19" y2="14" /></>),
  message: (<><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></>),
  messages: (<><path d="M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10" /><path d="M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2" /></>),
  camera: (<><path d="M5 7h2l2 -2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" /><circle cx="12" cy="13" r="3" /></>),
  bolt: (<polyline points="13 3 13 10 19 10 11 21 11 14 5 14 13 3" />),
  'map-pin': (<><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" /></>),
  'clipboard-check': (<><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /><rect x="9" y="3" width="6" height="4" rx="2" /><path d="M9 14l2 2l4 -4" /></>),
  check: (<polyline points="5 12 10 17 20 7" />),
  'arrow-back-up': (<path d="M9 14l-4 -4l4 -4M5 10h11a4 4 0 1 1 0 8h-1" />),
  edit: (<><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" /><path d="M16 5l3 3" /></>),
}

function SheetActionIcon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {SHEET_ICONS[name] ?? SHEET_ICONS.message}
    </svg>
  )
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
              <span className="mobileSheetActionIcon" aria-hidden><SheetActionIcon name={a.icon} /></span>
              <span className="mobileSheetActionLabel">{a.label}</span>
              <span className="mobileSheetActionChevron" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </span>
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
