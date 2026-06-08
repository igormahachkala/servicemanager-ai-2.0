import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { mobileAttachmentLabel, type MobileAttachmentLike } from './MobileAttachmentThumb'

const MAX_DOTS = 9

type HeroImageProps = {
  photo: MobileAttachmentLike
  onTap: () => void
}

function HeroImage({ photo, onTap }: HeroImageProps) {
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const resolved = api.resolveTicketAttachmentUrl(photo)
  const label = mobileAttachmentLabel(photo)

  useEffect(() => {
    setBroken(false)
    setLoaded(false)
  }, [photo.id, photo.url, photo.downloadUrl, photo.path, photo.filename, photo.originalName])

  if (!resolved) {
    return <div className="mobileTicketPhotoHeroPlaceholder">{label}</div>
  }

  if (broken) {
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

  return (
    <button
      type="button"
      className="mobileTicketPhotoHeroBtn"
      aria-label={`Открыть: ${label}`}
      onClick={onTap}
    >
      <img
        src={resolved}
        alt={label}
        className={`mobileTicketPhotoHeroImg${loaded ? '' : ' mobileTicketPhotoHeroImgPending'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
        draggable={false}
      />
    </button>
  )
}

type Props = {
  title: string
  photos: MobileAttachmentLike[]
  emptyText: string
  onOpen: (index: number) => void
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
            {current ? <HeroImage photo={current} onTap={() => onOpen(idx)} /> : null}
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
