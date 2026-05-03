import { useEffect } from 'react'
import supportQr from '../assets/support-qr.png'
import '../mobile/mobile.css'

type SupportQrModalProps = {
  open: boolean
  onClose: () => void
}

export function SupportQrModal({ open, onClose }: SupportQrModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="supportQrModalBackdrop" role="presentation" onClick={onClose}>
      <div
        className="supportQrModalCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supportQrModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="supportQrModalTitle" className="supportQrModalTitle">
          Поддержка
        </h2>
        <p className="supportQrModalText">Отсканируйте QR-код, чтобы написать в поддержку</p>
        <figure className="supportQrModalFigure">
          <img src={supportQr} alt="QR-код поддержки" width={280} height={280} decoding="async" />
        </figure>
        <button type="button" className="supportQrModalCloseBtn" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
