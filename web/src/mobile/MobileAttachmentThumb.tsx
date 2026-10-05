import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { ticketMediaKind } from '../lib/ticketAttachmentMedia'
import { useProtectedUploadSource } from '../ui/useProtectedUploadSrc'

export type MobileAttachmentLike = {
  id?: string | null
  url?: string | null
  downloadUrl?: string | null
  path?: string | null
  filename?: string | null
  originalName?: string | null
  mimeType?: string | null
}

export type MobileAttachmentPreviewPayload = {
  src: string
  alt: string
}

export function mobileAttachmentLabel(attachment: MobileAttachmentLike) {
  const filename = (attachment.filename || '').trim()
  if (filename) return filename
  return (attachment.originalName || '').trim() || 'Фото'
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
  onOpenPreview?: (payload: MobileAttachmentPreviewPayload) => void
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const resolved = api.resolveTicketAttachmentUrl(attachment)
  const source = useProtectedUploadSource(resolved)
  const label = mobileAttachmentLabel(attachment)
  const mediaKind = ticketMediaKind(attachment)

  useEffect(() => {
    setBroken(false)
    setLoaded(false)
  }, [
    attachment.id,
    attachment.url,
    attachment.downloadUrl,
    attachment.path,
    attachment.mimeType,
    attachment.filename,
    attachment.originalName,
  ])

  if (!resolved) {
    return (
      <div className="mobilePhotoFallbackLink mobilePhotoFallbackLinkStatic">
        <span className="mobilePhotoFallbackTitle">{label}</span>
        <span className="mobilePhotoFallbackAction">Нет ссылки на файл</span>
      </div>
    )
  }

  if (!mediaKind || broken || source.failed) {
    return <FallbackLink href={source.src || resolved} label={label} />
  }

  if (source.loading || !source.src) {
    return (
      <div className="mobilePhotoFallbackLink mobilePhotoFallbackLinkStatic">
        <span className="mobilePhotoFallbackTitle">{label}</span>
        <span className="mobilePhotoFallbackAction">Загрузка…</span>
      </div>
    )
  }

  if (mediaKind === 'video') {
    return (
      <video
        src={source.src}
        className={loaded ? className : `${className} mobilePhotoThumbPending`}
        controls
        playsInline
        preload="metadata"
        aria-label={label}
        onLoadedMetadata={() => setLoaded(true)}
        onError={() => setBroken(true)}
      />
    )
  }

  const img = (
    <img
      src={source.src}
      alt={label}
      className={loaded ? className : `${className} mobilePhotoThumbPending`}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setBroken(true)}
    />
  )

  if (onOpenPreview) {
    return (
      <button
        type="button"
        className="mobilePhotoThumbLink mobilePhotoThumbOpen"
        aria-label={`Открыть фото: ${label}`}
        onClick={() => onOpenPreview({ src: source.src, alt: label })}
      >
        {img}
      </button>
    )
  }

  return (
    <a className="mobilePhotoThumbLink" href={source.src} target="_blank" rel="noreferrer">
      {img}
    </a>
  )
}
