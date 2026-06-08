import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { mobileAttachmentLabel, type MobileAttachmentLike } from './MobileAttachmentThumb'

const MAX_DOTS = 9

type HeroImageProps = {
  photo: MobileAttachmentLike
  onTap: (src: string) => void
}

function HeroImage({ photo, onTap }: HeroImageProps) {
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const resolved = api.resolveTicketAttachmentUrl(photo)
  const previewSrc = objectUrl || resolved
  const label = mobileAttachmentLabel(photo)

  useEffect(() => {
    setBroken(false)
    setLoaded(false)
    setObjectUrl(null)
    setFetchFailed(false)
  }, [photo.id, photo.url, photo.downloadUrl, photo.path, photo.filename, photo.originalName])

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
      if (!blob) { setFetchFailed(true); return }
      setObjectUrl(URL.createObjectURL(blob))
      setBroken(false)
      setLoaded(false)
    })
    return () => { cancelled = true }
  }, [broken, fetchFailed, objectUrl, resolved])

  if (!resolved) {
    return <div className="mobileTicketPhotoHeroPlaceholder">{label}</div>
  }

  if (!canPreviewInBrowser(photo.mimeType) || (broken && fetchFailed)) {
    return (
      <a
        className="mobileTicketPhotoHeroPlaceholder mobileTicketPhotoHeroPlaceholder--link"
        href={resolved}
        target="_blank"
        rel="noreferrer"
      >
        Открыть фото ↗
      </a>
    )
  }

  if (broken && !objectUrl) {
    return (
      <div className="mobileTicketPhotoHeroPlaceholder">
        <span style={{ fontSize: '0.78rem' }}>Загрузка…</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="mobileTicketPhotoHeroBtn"
      aria-label={`Открыть: ${label}`}
      onClick={() => onTap(previewSrc)}
    >
      <img
        src={previewSrc}
        alt={label}
        className={`mobileTicketPhotoHeroImg${loaded ? '' : ' mobileTicketPhotoHeroImgPending'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (objectUrl) { setFetchFailed(true); return }
          setBroken(true)
        }}
        draggable={false}
      />
    </button>
  )
}

function canPreviewInBrowser(mimeType?: string | null) {
  const mime = (mimeType || '').trim().toLowerCase()
  return !mime || mime.startsWith('image/')
}

type Props = {
  title: string
  photos: MobileAttachmentLike[]
  emptyText: string
  onOpen: (index: number, resolvedSrc: string) => void
}

export function MobileTicketPhotoGallery({ title, photos, emptyText, onOpen }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)

  const count = photos.length
  const idx = count === 0 ? 0 : Math.min(Math.max(activeIndex, 0), count - 1)
  const current = photos[idx]

  useEffect(() => {
    setActiveIndex(0)
  }, [count])

  return (
    <div className="mobileTicketPhotoGallery">
      <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>
        {title}
      </div>
      {count === 0 ? (
        <div className="mobileMeta">{emptyText}</div>
      ) : (
        <>
          <div className="mobileTicketPhotoHero">
            {current ? <HeroImage photo={current} onTap={(src) => onOpen(idx, src)} /> : null}
          </div>
          <div className="mobileTicketPhotoDots">
            {count <= MAX_DOTS
              ? photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`mobileTicketPhotoDot${i === idx ? ' mobileTicketPhotoDotActive' : ''}`}
                    aria-label={`Перейти к фото ${i + 1}`}
                    onClick={() => setActiveIndex(i)}
                  />
                ))
              : null}
          </div>
          <div className="mobileTicketPhotoCounter">
            Фото {idx + 1} из {count}
          </div>
        </>
      )}
    </div>
  )
}
