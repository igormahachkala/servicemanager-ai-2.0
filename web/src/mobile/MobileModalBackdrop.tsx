import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  children: ReactNode
  ariaLabel: string
  onClose?: () => void
  align?: 'bottom' | 'center'
}

export function MobileModalBackdrop({ children, ariaLabel, onClose, align = 'bottom' }: Props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`mobileModalBackdrop${align === 'center' ? ' mobileModalBackdropCenter' : ''}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="mobileModalPanel"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
