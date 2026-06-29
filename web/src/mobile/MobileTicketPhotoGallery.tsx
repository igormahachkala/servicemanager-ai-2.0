import { useEffect, useRef, useState, type TouchEvent } from 'react'
import * as api from '../lib/api'
import { MobileAttachmentThumb, mobileAttachmentLabel, type MobileAttachmentLike } from './MobileAttachmentThumb'

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
  const touchStartXRef = useRef<number | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)

  const count = photos.length
  const idx = count === 0 ? 0 : Math.min(Math.max(activeIndex, 0), count - 1)
  const current = photos[idx]

  useEffect(() => {
    setActiveIndex(0)
  }, [count])

  // SMA-MOBILE-P0-GALLERY-001: держим активную миниатюру в зоне видимости ленты (большие галереи).
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const activeEl = rail.querySelector<HTMLElement>('[data-active="true"]')
    activeEl?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [idx, count])

  // Циклическая навигация — работает при любом количестве фото.
  const goTo = (next: number) => {
    if (count < 1) return
    setActiveIndex(((next % count) + count) % count)
  }

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchStartXRef.current
    touchStartXRef.current = null
    if (start == null || count < 2) return
    const dx = (e.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(dx) < 40) return
    goTo(dx < 0 ? idx + 1 : idx - 1)
  }

  return (
    <div className="mobileTicketPhotoGallery">
      <div className="mobileTicketPhotoGalleryHeader">
        <span className="mobileSectionTitle">{title}</span>
        {count > 0 ? <span className="mobileTicketPhotoGalleryCount">{count} фото</span> : null}
      </div>
      {count === 0 ? (
        <div className="mobileMeta">{emptyText}</div>
      ) : (
        <>
          <div className="mobileTicketPhotoHero" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {current ? <HeroImage photo={current} onTap={(src) => onOpen(idx, src)} /> : null}
            {count > 1 ? (
              <>
                <button
                  type="button"
                  className="mobileTicketPhotoArrow mobileTicketPhotoArrow--prev"
                  aria-label="Предыдущее фото"
                  onClick={() => goTo(idx - 1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="mobileTicketPhotoArrow mobileTicketPhotoArrow--next"
                  aria-label="Следующее фото"
                  onClick={() => goTo(idx + 1)}
                >
                  ›
                </button>
              </>
            ) : null}
          </div>

          {count > 1 ? (
            <div className="mobileTicketPhotoCounter">
              {idx + 1} / {count}
            </div>
          ) : null}

          {count > 1 && count <= MAX_DOTS ? (
            <div className="mobileTicketPhotoDots">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`mobileTicketPhotoDot${i === idx ? ' mobileTicketPhotoDotActive' : ''}`}
                  aria-label={`Перейти к фото ${i + 1}`}
                  onClick={() => setActiveIndex(i)}
                />
              ))}
            </div>
          ) : null}

          {/* >9 фото: лента миниатюр с прямым доступом к любому снимку. */}
          {count > MAX_DOTS ? (
            <div className="mobileTicketPhotoRail" ref={railRef}>
              {photos.map((photo, i) => (
                <div
                  key={photo.id ?? i}
                  data-active={i === idx}
                  className={`mobileTicketPhotoRailItem${i === idx ? ' mobileTicketPhotoRailItem--active' : ''}`}
                >
                  <MobileAttachmentThumb
                    attachment={photo}
                    className="mobileTicketPhotoRailImg"
                    onOpenPreview={() => setActiveIndex(i)}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
