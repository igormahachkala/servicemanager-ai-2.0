import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n'
import { MobileBottomSheetProvider, useMobileBottomSheet } from '../hooks/useMobileBottomSheet'

const SHEET_OPEN_CLASS = 'acMobileSheetOpen'

function MobileBottomSheetPanel() {
  const { t } = useI18n()
  const { isOpen, title, ariaLabel, content, dismissible, variant, closeSheet } =
    useMobileBottomSheet()
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    document.documentElement.classList.add(SHEET_OPEN_CLASS)
    return () => {
      document.documentElement.classList.remove(SHEET_OPEN_CLASS)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) closeSheet()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, dismissible, closeSheet])

  useEffect(() => {
    if (!isOpen) return
    bodyRef.current?.scrollTo({ top: 0 })
  }, [isOpen, content])

  if (!isOpen || !content) return null

  return createPortal(
    <div
      className={
        variant === 'guide'
          ? 'acMobileSheetRoot acMobileSheetRootGuide'
          : 'acMobileSheetRoot'
      }
      role="presentation"
    >
      <button
        type="button"
        className="acMobileSheetBackdrop"
        aria-label={t.mobile.sheet.dismiss}
        onClick={dismissible ? closeSheet : undefined}
        tabIndex={dismissible ? 0 : -1}
      />
      <div
        className={
          variant === 'guide'
            ? 'acMobileSheetPanel acMobileSheetPanelGuide'
            : 'acMobileSheetPanel'
        }
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title ?? t.mobile.sheet.close}
      >
        <div className="acMobileSheetHandle" aria-hidden />
        {title ? (
          <header className="acMobileSheetHeader">
            <h2 className="acMobileSheetTitle">{title}</h2>
            {dismissible ? (
              <button type="button" className="acMobileSheetClose" onClick={closeSheet}>
                {t.mobile.sheet.close}
              </button>
            ) : null}
          </header>
        ) : null}
        <div ref={bodyRef} className="acMobileSheetBody">
          {content}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function MobileBottomSheetHost({ children }: { children: React.ReactNode }) {
  return (
    <MobileBottomSheetProvider>
      {children}
      <MobileBottomSheetPanel />
    </MobileBottomSheetProvider>
  )
}
