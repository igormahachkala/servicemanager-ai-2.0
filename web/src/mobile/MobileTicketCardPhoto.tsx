import { useEffect, useState } from 'react'
import * as api from '../lib/api'

type Props = {
  previewUrl?: string | null
  imageCount?: number
  alt?: string
}

export function MobileTicketCardPhoto({ previewUrl, imageCount = 0, alt = 'Фото заявки' }: Props) {
  const [broken, setBroken] = useState(false)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const resolved = previewUrl ? api.resolveTicketAttachmentUrl({ url: previewUrl }) : ''
  const src = objectUrl || resolved
  const count = Math.max(0, imageCount)

  useEffect(() => {
    setBroken(false)
    setObjectUrl(null)
    setFetchFailed(false)
  }, [previewUrl])

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
    })
    return () => {
      cancelled = true
    }
  }, [broken, fetchFailed, objectUrl, resolved])

  if (!previewUrl || (broken && fetchFailed)) {
    return (
      <div className="mobileTicketCardPhoto mobileTicketCardPhotoPlaceholder" aria-hidden="true">
        <span className="mobileTicketCardPhotoIcon" aria-hidden="true">📷</span>
      </div>
    )
  }

  if (broken && !objectUrl) {
    return (
      <div className="mobileTicketCardPhoto mobileTicketCardPhotoPlaceholder" aria-hidden="true">
        <span className="mobileTicketCardPhotoIcon" aria-hidden="true">…</span>
      </div>
    )
  }

  return (
    <div className="mobileTicketCardPhoto">
      <img
        src={src}
        alt={alt}
        className="mobileTicketCardPhotoImg"
        loading="lazy"
        onError={() => setBroken(true)}
      />
      {count > 1 ? <span className="mobileTicketCardPhotoBadge">{count}</span> : null}
    </div>
  )
}
