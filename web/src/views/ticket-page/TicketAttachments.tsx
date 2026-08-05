import { useState } from 'react'
import * as api from '../../lib/api'
import { FullscreenPhotoViewer, type PhotoViewerItem } from '../../components/FullscreenPhotoViewer'
import { ticketMediaKind } from '../../lib/ticketAttachmentMedia'

type TicketAttachmentsProps = {
  title?: string
  emptyText?: string
  loading: boolean
  isError: boolean
  error?: unknown
  data?: api.TicketAttachmentItem[]
  canDeletePhoto: boolean
  deletePending: boolean
  onDelete: (attachmentId: string) => void
  deleteAttachmentError?: string | null
  fmt: (dt?: string | null) => string
  fmtBytes: (v?: number | null) => string
}

export function TicketAttachments(props: TicketAttachmentsProps) {
  const {
    title,
    emptyText,
    loading,
    isError,
    error,
    data,
    canDeletePhoto,
    deletePending,
    onDelete,
    deleteAttachmentError,
    fmt,
    fmtBytes,
  } = props

  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const photos: PhotoViewerItem[] = (data ?? [])
    .filter((a) => a.mimeType.startsWith('image/'))
    .map((a) => ({ src: api.resolveTicketAttachmentUrl(a), alt: a.originalName }))

  function photoIndexFor(attachment: api.TicketAttachmentItem): number {
    return photos.findIndex((p) => p.alt === attachment.originalName && p.src === api.resolveTicketAttachmentUrl(attachment))
  }

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>{title || 'Вложения'}</h3>
      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ width: 280, height: 16, borderRadius: 10, background: '#eef2ff', border: '1px solid #e6e8f0' }} />
          <div style={{ width: 340, height: 16, borderRadius: 10, background: '#eef2ff', border: '1px solid #e6e8f0' }} />
        </div>
      ) : isError ? (
        <div className="alert">{(error as any)?.message || String(error)}</div>
      ) : data && data.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.map((attachment) => {
            const isImage = attachment.mimeType.startsWith('image/')
            const isVideo = ticketMediaKind(attachment) === 'video'
            const idx = isImage ? photoIndexFor(attachment) : -1
            return (
              <div key={attachment.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {isImage ? (
                    <img
                      src={api.resolveTicketAttachmentUrl(attachment)}
                      alt={attachment.originalName}
                      style={{ width: 220, maxWidth: '100%', borderRadius: 10, border: '1px solid #e5e7eb', objectFit: 'cover', cursor: 'zoom-in' }}
                      onClick={() => setViewerIndex(idx)}
                    />
                  ) : isVideo ? (
                    <video
                      src={api.resolveTicketAttachmentUrl(attachment)}
                      controls
                      preload="metadata"
                      style={{ width: 420, maxWidth: '100%', maxHeight: 320, borderRadius: 10, border: '1px solid #e5e7eb', background: '#111827' }}
                    />
                  ) : (
                    <div style={{ width: 220, maxWidth: '100%', minHeight: 80, borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="muted small">Не изображение</span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: 6, minWidth: 240 }}>
                    <div><b>{attachment.originalName}</b></div>
                    <div className="muted small">Размер: {fmtBytes(attachment.sizeBytes)}</div>
                    <div className="muted small">Загружено: {fmt(attachment.createdAt)}</div>
                    <div className="muted small">Кем: {attachment.uploadedBy?.email || '—'}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {isImage && (
                        <button className="ghost" onClick={() => setViewerIndex(idx)}>
                          Просмотр фото
                        </button>
                      )}
                      <a href={api.resolveTicketAttachmentUrl(attachment)} target="_blank" rel="noreferrer">
                        <button className="ghost">Открыть</button>
                      </a>
                      {canDeletePhoto ? (
                        <button className="ghost" onClick={() => onDelete(attachment.id)} disabled={deletePending}>
                          {deletePending ? 'Удаляем…' : 'Удалить'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="muted small">{emptyText || 'Вложений пока нет'}</div>
      )}
      {deleteAttachmentError ? <div className="alert" style={{ marginTop: 10 }}>{deleteAttachmentError}</div> : null}

      {viewerIndex !== null && photos.length > 0 && (
        <FullscreenPhotoViewer
          items={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  )
}
