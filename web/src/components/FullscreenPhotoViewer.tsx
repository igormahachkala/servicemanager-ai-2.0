import { useCallback, useEffect, useState } from 'react'
import './FullscreenPhotoViewer.css'

export type PhotoViewerItem = {
  src: string
  alt: string
}

type Props = {
  items: PhotoViewerItem[]
  initialIndex: number
  onClose: () => void
}

export function FullscreenPhotoViewer({ items, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)

  const prev = useCallback(() => {
    setZoomed(false)
    setIndex((i) => (i - 1 + items.length) % items.length)
  }, [items.length])

  const next = useCallback(() => {
    setZoomed(false)
    setIndex((i) => (i + 1) % items.length)
  }, [items.length])

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, prev, next])

  const item = items[index]
  if (!item) return null

  return (
    <div
      className="fsv-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      onClick={onClose}
    >
      <div className="fsv-panel" onClick={(e) => e.stopPropagation()}>
        <div className="fsv-toolbar">
          <span className="fsv-counter">{index + 1} / {items.length}</span>
          <div className="fsv-toolbar-actions">
            <button
              type="button"
              className="fsv-btn"
              onClick={() => setZoomed((z) => !z)}
              title={zoomed ? 'Уменьшить' : 'Увеличить'}
            >
              {zoomed ? '⊖' : '⊕'}
            </button>
            <a
              className="fsv-btn"
              href={item.src}
              target="_blank"
              rel="noreferrer"
              title="Открыть оригинал"
              onClick={(e) => e.stopPropagation()}
            >
              ↗
            </a>
            <button type="button" className="fsv-btn fsv-close" onClick={onClose} title="Закрыть (Esc)">
              ✕
            </button>
          </div>
        </div>

        <div className="fsv-frame">
          {items.length > 1 && (
            <button type="button" className="fsv-nav fsv-nav-prev" onClick={prev} title="Назад (←)">
              ‹
            </button>
          )}

          <div className={`fsv-img-wrap${zoomed ? ' fsv-img-wrap--zoomed' : ''}`}>
            <img
              key={item.src}
              src={item.src}
              alt={item.alt}
              className={`fsv-img${zoomed ? ' fsv-img--zoomed' : ''}`}
              onClick={() => setZoomed((z) => !z)}
              draggable={false}
            />
          </div>

          {items.length > 1 && (
            <button type="button" className="fsv-nav fsv-nav-next" onClick={next} title="Вперёд (→)">
              ›
            </button>
          )}
        </div>

        <div className="fsv-name">{item.alt}</div>
      </div>
    </div>
  )
}
