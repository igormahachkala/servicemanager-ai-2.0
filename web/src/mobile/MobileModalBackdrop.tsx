import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  children: ReactNode
  ariaLabel: string
  onClose?: () => void
  align?: 'bottom' | 'center'
  backdropClassName?: string
}

export function MobileModalBackdrop({ children, ariaLabel, onClose, align = 'bottom', backdropClassName }: Props) {
  if (typeof document === 'undefined') return null

  const backdropClass = [
    'mobileModalBackdrop',
    align === 'center' ? 'mobileModalBackdropCenter' : '',
    backdropClassName || '',
  ].filter(Boolean).join(' ')

  return createPortal(
    <div
      className={backdropClass}
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
