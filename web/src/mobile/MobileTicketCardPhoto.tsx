import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { useProtectedUploadSource } from '../ui/useProtectedUploadSrc'

type Props = {
  previewUrl?: string | null
  imageCount?: number
  alt?: string
}

export function MobileTicketCardPhoto({ previewUrl, imageCount = 0, alt = 'Фото заявки' }: Props) {
  const [broken, setBroken] = useState(false)
  const resolved = previewUrl ? api.resolveTicketAttachmentUrl({ url: previewUrl }) : ''
  const source = useProtectedUploadSource(resolved)
  const count = Math.max(0, imageCount)

  useEffect(() => {
    setBroken(false)
  }, [previewUrl])

  if (!previewUrl || broken || source.failed) {
    return (
      <div className="mobileTicketCardPhoto mobileTicketCardPhotoPlaceholder" aria-hidden="true">
        <span className="mobileTicketCardPhotoIcon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7h2l2 -2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </span>
      </div>
    )
  }

  if (source.loading || !source.src) {
    return (
      <div className="mobileTicketCardPhoto mobileTicketCardPhotoPlaceholder" aria-hidden="true">
        <span className="mobileTicketCardPhotoIcon" aria-hidden="true">…</span>
      </div>
    )
  }

  return (
    <div className="mobileTicketCardPhoto">
      <img
        src={source.src}
        alt={alt}
        className="mobileTicketCardPhotoImg"
        loading="lazy"
        onError={() => setBroken(true)}
      />
      {count > 1 ? <span className="mobileTicketCardPhotoBadge">{count}</span> : null}
    </div>
  )
}
