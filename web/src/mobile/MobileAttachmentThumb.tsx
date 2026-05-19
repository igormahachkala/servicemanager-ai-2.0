import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'

export type MobileAttachmentLike = {
  id?: string | null
  url?: string | null
  downloadUrl?: string | null
  path?: string | null
  filename?: string | null
  originalName?: string | null
  mimeType?: string | null
}

export function mobileAttachmentLabel(attachment: MobileAttachmentLike) {
  const filename = (attachment.filename || '').trim()
  if (filename) return filename
  return (attachment.originalName || '').trim() || 'Фото'
}

function canPreviewInBrowser(mimeType?: string | null) {
  const mime = (mimeType || '').trim().toLowerCase()
  if (!mime) return true
  return (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    mime === 'image/gif' ||
    mime === 'image/avif' ||
    mime === 'image/svg+xml'
  )
}

function FallbackLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="mobilePhotoFallbackLink" href={href} target="_blank" rel="noreferrer">
      <span className="mobilePhotoFallbackTitle">{label}</span>
      <span className="mobilePhotoFallbackAction">Открыть фото</span>
    </a>
  )
}

export function MobileAttachmentThumb({
  attachment,
  onOpenPreview,
  className = 'mobilePhotoThumb',
}: {
  attachment: MobileAttachmentLike
  onOpenPreview?: (payload: { src: string; alt: string }) => void
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const resolved = useMemo(() => api.resolveTicketAttachmentUrl(attachment), [attachment])
  const label = mobileAttachmentLabel(attachment)
  const canPreview = canPreviewInBrowser(attachment.mimeType)

  useEffect(() => {
    setBroken(false)
  }, [attachment.id, resolved])

  if (!resolved) {
    return (
      <div className="mobilePhotoFallbackLink mobilePhotoFallbackLinkStatic">
        <span className="mobilePhotoFallbackTitle">{label}</span>
        <span className="mobilePhotoFallbackAction">Нет ссылки на файл</span>
      </div>
    )
  }

  if (broken || !canPreview) {
    return <FallbackLink href={resolved} label={label} />
  }

  const img = (
    <img
      src={resolved}
      alt={label}
      className={className}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  )

  if (onOpenPreview) {
    return (
      <button
        type="button"
        className="mobilePhotoThumbLink mobilePhotoThumbOpen"
        aria-label={`Открыть фото: ${label}`}
        onClick={() => onOpenPreview({ src: resolved, alt: label })}
      >
        {img}
      </button>
    )
  }

  return (
    <a className="mobilePhotoThumbLink" href={resolved} target="_blank" rel="noreferrer">
      {img}
    </a>
  )
}
