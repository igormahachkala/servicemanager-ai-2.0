import * as api from '../../lib/api'

type TicketAttachmentsProps = {
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

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Вложения</h3>
      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ width: 280, height: 16, borderRadius: 10, background: '#eef2ff', border: '1px solid #e6e8f0' }} />
          <div style={{ width: 340, height: 16, borderRadius: 10, background: '#eef2ff', border: '1px solid #e6e8f0' }} />
        </div>
      ) : isError ? (
        <div className="alert">{(error as any)?.message || String(error)}</div>
      ) : data && data.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.map((attachment) => (
            <div key={attachment.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <img src={api.resolveFileUrl(attachment.url)} alt={attachment.originalName} style={{ width: 220, maxWidth: '100%', borderRadius: 10, border: '1px solid #e5e7eb', objectFit: 'cover' }} />
                <div style={{ display: 'grid', gap: 6, minWidth: 240 }}>
                  <div><b>{attachment.originalName}</b></div>
                  <div className="muted small">Размер: {fmtBytes(attachment.sizeBytes)}</div>
                  <div className="muted small">Загружено: {fmt(attachment.createdAt)}</div>
                  <div className="muted small">Кем: {attachment.uploadedBy?.email || '—'}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <a href={api.resolveFileUrl(attachment.url)} target="_blank" rel="noreferrer">
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
          ))}
        </div>
      ) : (
        <div className="muted small">Вложений пока нет</div>
      )}
      {deleteAttachmentError ? <div className="alert" style={{ marginTop: 10 }}>{deleteAttachmentError}</div> : null}
    </div>
  )
}
