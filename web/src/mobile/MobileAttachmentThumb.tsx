import { useEffect, useState } from 'react'
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

export type MobileAttachmentPreviewPayload = {
  src: string
  alt: string
}

export function mobileAttachmentLabel(attachment: MobileAttachmentLike) {
  const filename = (attachment.filename || '').trim()
  if (filename) return filename
  return (attachment.originalName || '').trim() || 'Фото'
}

function canPreviewInBrowser(mimeType?: string | null) {
  const mime = (mimeType || '').trim().toLowerCase()
  if (!mime) return true
  return mime.startsWith('image/')
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
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const resolved = api.resolveTicketAttachmentUrl(attachment)
  const previewSrc = objectUrl || resolved
  const label = mobileAttachmentLabel(attachment)
  const canPreview = canPreviewInBrowser(attachment.mimeType)

  useEffect(() => {
    setBroken(false)
    setLoaded(false)
    setObjectUrl(null)
    setFetchFailed(false)
  }, [
    attachment.id,
    attachment.url,
    attachment.downloadUrl,
    attachment.path,
    attachment.mimeType,
    attachment.filename,
    attachment.originalName,
  ])

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  useEffect(() => {
    if (!broken || objectUrl || fetchFailed || !resolved || !api.isProtectedUploadUrl(resolved)) return

    let cancelled = false
    void api.fetchProtectedUploadBlob(resolved).then((blob) => {
      if (cancelled) return
      if (!blob) {
        setFetchFailed(true)
        return
      }
      setObjectUrl(URL.createObjectURL(blob))
      setBroken(false)
      setLoaded(false)
    })

    return () => {
      cancelled = true
    }
  }, [broken, fetchFailed, objectUrl, resolved])

  if (!resolved) {
    return (
      <div className="mobilePhotoFallbackLink mobilePhotoFallbackLinkStatic">
        <span className="mobilePhotoFallbackTitle">{label}</span>
        <span className="mobilePhotoFallbackAction">Нет ссылки на файл</span>
      </div>
    )
  }

  if (!canPreview || (broken && fetchFailed)) {
    return <FallbackLink href={resolved} label={label} />
  }

  if (broken && !objectUrl) {
    return (
      <div className="mobilePhotoFallbackLink mobilePhotoFallbackLinkStatic">
        <span className="mobilePhotoFallbackTitle">{label}</span>
        <span className="mobilePhotoFallbackAction">Загрузка…</span>
      </div>
    )
  }

  const img = (
    <img
      src={previewSrc}
      alt={label}
      className={loaded ? className : `${className} mobilePhotoThumbPending`}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (objectUrl) {
          setFetchFailed(true)
          return
        }
        setBroken(true)
      }}
    />
  )

  if (onOpenPreview) {
    return (
      <button
        type="button"
        className="mobilePhotoThumbLink mobilePhotoThumbOpen"
        aria-label={`Открыть фото: ${label}`}
        onClick={() => onOpenPreview({ src: previewSrc, alt: label })}
      >
        {img}
      </button>
    )
  }

  return (
    <a className="mobilePhotoThumbLink" href={previewSrc} target="_blank" rel="noreferrer">
      {img}
    </a>
  )
}
