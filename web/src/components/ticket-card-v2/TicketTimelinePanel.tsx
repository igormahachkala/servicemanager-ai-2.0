import type * as api from '../../lib/api'
import { mapReason } from '../../lib/assignmentExplain'

type Props = {
  loading: boolean
  isError: boolean
  error?: unknown
  items: api.TimelineItem[]
  previewItems: api.TimelineItem[]
  showFullTimeline: boolean
  onToggleShowFull: () => void
  fmt: (dt?: string | null) => string
  sourceLabel: (source: api.TimelineItem['source']) => string
  timelineTypeLabel: (type: string) => string
}

export function TicketTimelinePanel({
  loading,
  isError,
  error,
  items,
  previewItems,
  showFullTimeline,
  onToggleShowFull,
  fmt,
  sourceLabel,
  timelineTypeLabel,
}: Props) {
  return (
    <div className="panel uiCard" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>История</h3>
      {loading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ width: 320, height: 16, borderRadius: 10, background: '#eef2ff', border: '1px solid #e6e8f0' }} />
          <div style={{ width: 360, height: 16, borderRadius: 10, background: '#eef2ff', border: '1px solid #e6e8f0' }} />
          <div style={{ width: 300, height: 16, borderRadius: 10, background: '#eef2ff', border: '1px solid #e6e8f0' }} />
        </div>
      ) : isError ? (
        <div className="alert">{(error as any)?.message || String(error)}</div>
      ) : items.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {previewItems.map((item, idx) => (
            <div key={`${item.at}-${item.type}-${idx}`} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <b>{item.title}</b>
                <span className="tag">{sourceLabel(item.source)}</span>
                <span className="tag">{timelineTypeLabel(item.type || item.domainType || item.timelineEvent || 'event')}</span>
              </div>
              <div className="muted small">{fmt(item.at)} · {item.actor?.email || 'система'}</div>
              {String(item.type || item.timelineEvent || '').toLowerCase().includes('assign') ? (
                <div className="muted small">
                  Система назначила исполнителя. Причина: {mapReason(String(item.payload?.reason || 'решение системы'))}
                </div>
              ) : null}
              {item.payload ? (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, fontSize: 12 }}>
                  {JSON.stringify(item.payload, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
          {items.length > 5 ? (
            <button className="ghost" type="button" onClick={onToggleShowFull}>
              {showFullTimeline ? 'Скрыть полный таймлайн' : `Показать полный таймлайн (${items.length})`}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="muted small">Событий пока нет</div>
      )}
    </div>
  )
}
