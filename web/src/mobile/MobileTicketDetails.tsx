import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

function formatWhen(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('ru-RU', { hour12: false })
}

function actorLabel(actor: { email?: string | null } | null | undefined) {
  return (actor?.email || '').trim()
}

function pickString(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed) return trimmed
    }
  }
  return ''
}

function looksLikeJson(value: string) {
  const t = value.trim()
  return t.startsWith('{') || t.startsWith('[')
}

function normalizeTimelineItems(data: api.TimelineResponse | undefined): api.TimelineItem[] {
  if (!data) return []
  if (Array.isArray(data.items) && data.items.length) return data.items
  if (Array.isArray(data.timeline) && data.timeline.length) return data.timeline
  return []
}

function isImageAttachment(item: api.TicketAttachmentItem) {
  return String(item.mimeType || '').startsWith('image/')
}

type ParsedComment = {
  at: string
  text: string
  actor: string
  source: string
  toStatus: string
}

function parseComments(items: api.TimelineItem[]): ParsedComment[] {
  return items
    .filter((item) => item.type === 'COMMENT_ADDED' || item.timelineEvent === 'COMMENT_ADDED')
    .map((item) => {
      const payload = (item.payload || {}) as any
      const text = pickString(payload.comment, payload.text, item.title)
      const source = pickString(payload.source)
      const toStatus = pickString(payload.toStatus)
      return {
        at: item.at,
        text,
        actor: actorLabel(item.actor),
        source,
        toStatus,
      }
    })
    .filter((row) => row.text && row.text !== 'Ticket created')
}

export function MobileTicketDetails() {
  const params = useParams()
  const ticketId = (params.id || '').trim()
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId()).trim()
  const scope = useMemo(
    () => ({
      linkedClientCompanyId: linkedClientCompanyId || undefined,
      companyId: companyId || undefined,
    }),
    [linkedClientCompanyId, companyId],
  )

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const ticketQ = useQuery({
    queryKey: ['mobile-ticket', ticketId, linkedClientCompanyId, companyId],
    queryFn: () => api.getTicket(ticketId, scope),
    enabled: !!ticketId,
  })

  const attachmentsQ = useQuery({
    queryKey: ['mobile-ticket-attachments', ticketId, linkedClientCompanyId, companyId],
    queryFn: () => api.ticketAttachments(ticketId, scope),
    enabled: !!ticketId,
  })

  const timelineQ = useQuery({
    queryKey: ['mobile-ticket-timeline', ticketId, linkedClientCompanyId, companyId],
    queryFn: () => api.timeline(ticketId, scope),
    enabled: !!ticketId,
  })

  const ticket = ticketQ.data
  const attachments = (attachmentsQ.data || []).filter(isImageAttachment)

  const { requestPhotos, reportPhotos } = useMemo(() => {
    const reports = attachments.filter((row) => row.purpose === 'WORK_REPORT')
    const reportIds = new Set(reports.map((row) => row.id))
    const requests = attachments.filter((row) => !reportIds.has(row.id))
    return { requestPhotos: requests, reportPhotos: reports }
  }, [attachments])

  const timelineItems = useMemo(() => normalizeTimelineItems(timelineQ.data), [timelineQ.data])

  const parsedComments = useMemo(() => parseComments(timelineItems), [timelineItems])

  const createComment = useMemo(() => {
    const nonClose = parsedComments.filter((row) => !(row.source === 'status_change' && row.toStatus === 'DONE'))
    if (nonClose.length === 0) return null
    const sorted = [...nonClose].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    return sorted[0] || null
  }, [parsedComments])

  const closeComment = useMemo(() => {
    const candidates = parsedComments.filter((row) => row.source === 'status_change' && row.toStatus === 'DONE')
    if (candidates.length === 0) return null
    const sorted = [...candidates].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return sorted[0] || null
  }, [parsedComments])

  const problemText = pickString(ticket?.problemText, ticket?.description, ticket?.title)
  const categoryLine = `${ticket?.problemCategory?.name || 'Категория'} · ${ticket?.location?.name || ticket?.pointName || 'Локация'}`

  return (
    <div className="mobileSection">
      <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="mobileTitle">Заявка</h1>
          <div className="mobileSubtitle">Мобильная карточка</div>
        </div>
        <Link to={api.appendScopeToPath('/m', scope, meQ.data)} className="mobileMeta" style={{ textDecoration: 'none' }}>
          Назад
        </Link>
      </div>

      {ticketQ.isError ? <div className="mobileNotice mobileNoticeError">{String((ticketQ.error as any)?.message || ticketQ.error)}</div> : null}
      {attachmentsQ.isError ? <div className="mobileNotice mobileNoticeError">{String((attachmentsQ.error as any)?.message || attachmentsQ.error)}</div> : null}
      {timelineQ.isError ? <div className="mobileNotice mobileNoticeError">{String((timelineQ.error as any)?.message || timelineQ.error)}</div> : null}

      {!ticket ? (
        <div className="mobileCard mobileMeta">{ticketQ.isFetching ? 'Загружаем…' : 'Заявка не найдена'}</div>
      ) : (
        <>
          <div className="mobileCard">
            <div className="mobileMeta">Статус</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{ticket.status}</div>
            <div className="mobileMeta" style={{ marginTop: 10 }}>
              {categoryLine}
            </div>
            {problemText ? (
              <div style={{ marginTop: 10 }}>
                <div className="mobileMeta">Описание</div>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{problemText}</div>
              </div>
            ) : null}
          </div>

          <div className="mobileCard">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото заявки</div>
            {requestPhotos.length === 0 ? (
              <div className="mobileMeta">Фото заявки не прикреплены</div>
            ) : (
              <div className="mobilePhotoGrid">
                {requestPhotos.map((photo) => (
                  <a key={photo.id} href={api.resolveFileUrl(photo.url)} target="_blank" rel="noreferrer" className="mobilePhotoThumbLink">
                    <img className="mobilePhotoThumb" src={api.resolveFileUrl(photo.url)} alt={photo.originalName} loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="mobileCard">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото отчёта</div>
            {reportPhotos.length === 0 ? (
              <div className="mobileMeta">Фото отчёта пока нет</div>
            ) : (
              <div className="mobilePhotoGrid">
                {reportPhotos.map((photo) => (
                  <a key={photo.id} href={api.resolveFileUrl(photo.url)} target="_blank" rel="noreferrer" className="mobilePhotoThumbLink">
                    <img className="mobilePhotoThumb" src={api.resolveFileUrl(photo.url)} alt={photo.originalName} loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="mobileCard">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Комментарии</div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div className="mobileNotice" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#111827' }}>
                <div className="mobileMeta" style={{ marginBottom: 6 }}>
                  При создании
                </div>
                {createComment ? (
                  <>
                    <div style={{ fontWeight: 700 }}>{looksLikeJson(createComment.text) ? 'Комментарий сохранён' : createComment.text}</div>
                    <div className="mobileMeta" style={{ marginTop: 6 }}>
                      {[createComment.actor, formatWhen(createComment.at)].filter(Boolean).join(' · ')}
                    </div>
                  </>
                ) : (
                  <div className="mobileMeta">Комментариев пока нет</div>
                )}
              </div>

              <div className="mobileNotice" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#111827' }}>
                <div className="mobileMeta" style={{ marginBottom: 6 }}>
                  При закрытии
                </div>
                {closeComment ? (
                  <>
                    <div style={{ fontWeight: 700 }}>{looksLikeJson(closeComment.text) ? 'Комментарий сохранён' : closeComment.text}</div>
                    <div className="mobileMeta" style={{ marginTop: 6 }}>
                      {[closeComment.actor, formatWhen(closeComment.at)].filter(Boolean).join(' · ')}
                    </div>
                  </>
                ) : ticket.status === 'DONE' ? (
                  <div className="mobileMeta">Комментарий закрытия не найден</div>
                ) : (
                  <div className="mobileMeta">Заявка ещё не закрыта</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
