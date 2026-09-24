import { useEffect } from 'react'

export type MobilePhotoPreview = {
  src: string
  alt: string
}

type MobilePhotoLightboxProps = {
  preview: MobilePhotoPreview | null
  onClose: () => void
  ariaLabel?: string
}

export function MobilePhotoLightbox({ preview, onClose, ariaLabel = 'Просмотр фото' }: MobilePhotoLightboxProps) {
  useEffect(() => {
    if (!preview) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, preview])

  if (!preview) return null

  return (
    <div
      className="mobileImageLightbox"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <div className="mobileImageLightboxPanel" onClick={(e) => e.stopPropagation()}>
        <div className="mobileImageLightboxToolbar">
          <button type="button" className="mobileImageLightboxClose" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <div className="mobileImageLightboxFrame">
          <img src={preview.src} alt={preview.alt} className="mobileImageLightboxImg" />
        </div>
      </div>
    </div>
  )
}
