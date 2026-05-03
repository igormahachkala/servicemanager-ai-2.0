import { useEffect } from 'react'
import supportTelegramQr from '../assets/support-qr.png'
import supportEmailQr from '../assets/support-email-qr.png'
import '../mobile/mobile.css'

/** Синхронизировать с web/scripts/gen-support-qr.mjs */
export const SUPPORT_CONTACT_EMAIL = 'ai.service.manager.ufa@gmail.com'
export const SUPPORT_MAILTO_HREF = `mailto:${SUPPORT_CONTACT_EMAIL}`
export const SUPPORT_TELEGRAM_URL = 'https://t.me/igorpump'

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

        <div className="supportQrModalGrid">
          <div className="supportQrModalCol">
            <h3 className="supportQrModalColTitle">Telegram</h3>
            <p className="supportQrModalColHint">Отсканируйте QR-код или откройте чат по ссылке.</p>
            <figure className="supportQrModalFigure">
              <img src={supportTelegramQr} alt="QR-код Telegram поддержки" width={240} height={240} decoding="async" />
            </figure>
            <a
              href={SUPPORT_TELEGRAM_URL}
              className="supportQrModalLinkBtn supportQrModalLinkBtnTelegram"
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть Telegram
            </a>
          </div>

          <div className="supportQrModalCol">
            <h3 className="supportQrModalColTitle">Email</h3>
            <p className="supportQrModalColHint">Отсканируйте QR-код или напишите на почту.</p>
            <figure className="supportQrModalFigure">
              <img src={supportEmailQr} alt="QR-код email поддержки" width={240} height={240} decoding="async" />
            </figure>
            <a href={SUPPORT_MAILTO_HREF} className="supportQrModalLinkBtn supportQrModalLinkBtnEmail">
              Написать на email
            </a>
            <p className="supportQrModalEmailPlain">{SUPPORT_CONTACT_EMAIL}</p>
          </div>
        </div>

        <button type="button" className="supportQrModalCloseBtn" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
