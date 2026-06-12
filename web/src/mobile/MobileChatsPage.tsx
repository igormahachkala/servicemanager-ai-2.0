import { Link, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'
import { mobileTicketNumberTitle, mobileTicketStatusLabelRu } from './mobileTicketDisplay'

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function MobileChatsPage() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const scope = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      linkedClientCompanyId: (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim() || undefined,
      companyId: (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim() || undefined,
    }
  }, [location.search, meQ.data])

  const boardQ = useQuery({
    queryKey: ['mobile-chats-board', scope.linkedClientCompanyId, scope.companyId],
    queryFn: () =>
      api.board({
        linkedClientCompanyId: scope.linkedClientCompanyId,
        companyId: scope.companyId,
        take: 24,
      }),
    enabled: !!meQ.data,
  })

  const tickets = useMemo(() => {
    const items = boardQ.data?.columns.flatMap((col) => col.cards || []) || []
    return [...items].sort((a, b) => {
      const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (byDate !== 0) return byDate
      return (b.ticketNumber || 0) - (a.ticketNumber || 0)
    })
  }, [boardQ.data])

  const ticketHref = (ticket: api.TicketCard) =>
    api.appendScopeToPath(mobilePath(location.pathname, `/tickets/${ticket.id}`), scope, meQ.data)

  return (
    <div className="mobileSection">
      <div style={{ marginBottom: 4 }}>
        <h1 className="mobileTitle">Чаты</h1>
        <div className="mobileSubtitle">Чаты скоро появятся</div>
      </div>

      <div className="mobileCard mobileChatsPlaceholder">
        Пока показываем заявки как чат-ленту. Сообщения и история переписки появятся позже.
      </div>

      {boardQ.isLoading ? <div className="mobileSubtitle">Загрузка…</div> : null}
      {boardQ.isError ? (
        <div className="mobileNotice mobileNoticeError">{String((boardQ.error as any)?.message || boardQ.error)}</div>
      ) : null}

      {!boardQ.isLoading && tickets.length === 0 ? (
        <div className="mobileCard mobileEmptyState" role="status">
          <div className="mobileEmptyStateTitle">Чатов пока нет</div>
          <p className="mobileEmptyStateHint">Когда появятся заявки, они отобразятся здесь как список чатов.</p>
        </div>
      ) : null}

      {tickets.length > 0 ? (
        <div className="mobileChatsList">
          {tickets.map((ticket) => {
            const title = mobileTicketNumberTitle(ticket.ticketNumber)
            const status = mobileTicketStatusLabelRu(ticket.status)
            const preview = (ticket.description || ticket.title || 'Без описания').trim()
            const meta = [ticket.location?.name || ticket.pointName || '', ticket.requesterName || '']
              .filter(Boolean)
              .join(' · ')
            const when = fmtTime(ticket.createdAt)
            return (
              <Link key={ticket.id} to={ticketHref(ticket)} className="mobileChatsItem">
                <div className="mobileChatsItemTop">
                  <div className="mobileChatsItemTitle">{title}</div>
                  <div className="mobileChatsItemStatus">{status}</div>
                </div>
                <div className="mobileChatsItemPreview">{preview}</div>
                <div className="mobileChatsItemMeta">
                  <span>{meta || 'Заявка'}</span>
                  {when ? <span>{when}</span> : null}
                </div>
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
