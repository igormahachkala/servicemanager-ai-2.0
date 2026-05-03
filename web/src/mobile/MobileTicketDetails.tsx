import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', { hour12: false })
}

function groupAttachments(items: api.TicketAttachmentItem[]) {
  return {
    request: items.filter((item) => item?.purpose !== 'WORK_REPORT'),
    workReport: items.filter((item) => item?.purpose === 'WORK_REPORT'),
  }
}

export function MobileTicketDetails() {
  const params = useParams()
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId()).trim()
  const scope = {
    linkedClientCompanyId: linkedClientCompanyId || undefined,
    companyId: companyId || undefined,
  }
  const ticketId = (params.id || '').trim()

  const ticketQ = useQuery({
    queryKey: ['mobile-ticket', ticketId, linkedClientCompanyId, companyId],
    queryFn: () => api.ticket(ticketId, scope),
    enabled: !!ticketId,
  })

  const attachmentsQ = useQuery({
    queryKey: ['mobile-ticket-attachments', ticketId, linkedClientCompanyId, companyId],
    queryFn: () => api.ticketAttachments(ticketId, scope),
    enabled: !!ticketId,
  })

  const groupedAttachments = useMemo(() => groupAttachments(attachmentsQ.data || []), [attachmentsQ.data])
  const backHref = api.appendScopeToPath('/m/my', scope)
  const ticket = ticketQ.data

  return (
    <div className="mobileSection">
      <div className="mobileRow">
        <div>
          <h1 className="mobileTitle" style={{ marginBottom: 4 }}>
            {ticket ? `Заявка #${ticket.ticketNumber}` : 'Заявка'}
          </h1>
          <div className="mobileSubtitle">Детали заявки в мобильном контуре</div>
        </div>
        <Link to={backHref}>
          <button className="mobileBtn mobileBtnSecondary">Назад</button>
        </Link>
      </div>

      {ticketQ.isError ? <div className="mobileNotice mobileNoticeError">{String((ticketQ.error as any)?.message || ticketQ.error)}</div> : null}
      {attachmentsQ.isError ? <div className="mobileNotice mobileNoticeError">{String((attachmentsQ.error as any)?.message || attachmentsQ.error)}</div> : null}

      {ticket ? (
        <>
          <div className="mobileCard">
            <div className="mobileRow">
              <strong>{ticket.problemCategory?.name || ticket.title || 'Без категории'}</strong>
              <span className="mobileMeta">{ticket.status}</span>
            </div>
            <div className="mobileMeta" style={{ marginTop: 8 }}>
              Локация: {ticket.location?.name || ticket.pointName || 'Без локации'}
            </div>
            <div className="mobileMeta" style={{ marginTop: 6 }}>
              Создано: {formatDate(ticket.createdAt)}
            </div>
            <div className="mobileMeta" style={{ marginTop: 6 }}>
              Техник: {ticket.assignedTechnician?.email || 'Не назначен'}
            </div>
            <div style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{ticket.problemText || ticket.description || 'Описание отсутствует'}</div>
          </div>

          <div className="mobileCard">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Фото заявки</div>
            {groupedAttachments.request.length === 0 ? (
              <div className="mobileMeta">Нет фото заявки</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {groupedAttachments.request.map((attachment) => (
                  <a key={attachment.id} href={api.resolveFileUrl(attachment.url)} target="_blank" rel="noreferrer">
                    <img
                      src={api.resolveFileUrl(attachment.url)}
                      alt={attachment.originalName}
                      style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }}
                    />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="mobileCard">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Фото отчёта</div>
            {groupedAttachments.workReport.length === 0 ? (
              <div className="mobileMeta">Нет фото отчёта</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {groupedAttachments.workReport.map((attachment) => (
                  <a key={attachment.id} href={api.resolveFileUrl(attachment.url)} target="_blank" rel="noreferrer">
                    <img
                      src={api.resolveFileUrl(attachment.url)}
                      alt={attachment.originalName}
                      style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }}
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      ) : ticketQ.isLoading ? (
        <div className="mobileCard mobileMeta">Загружаем заявку…</div>
      ) : null}
    </div>
  )
}