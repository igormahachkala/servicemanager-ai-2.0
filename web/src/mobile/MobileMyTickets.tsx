import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  compactTicketScope,
  mobileTicketCategoryLocationFromCard,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  scopeForMobileTicketLink,
} from './mobileTicketDisplay'
import { MobileRoleContextStrip } from './MobileUxHints'
import { isMineTicketForRole } from './mobileHomeBoardFilters'
import { appendBoardNavigationContextToPath, readBoardNavigationContextFromSearch } from '../lib/boardNavigationContext'
import { mobilePath } from './mobileRoute'

type FilterKey = 'active' | 'new' | 'closed'

const filterMap: Record<FilterKey, api.TicketStatus[]> = {
  active: ['ASSIGNED', 'IN_PROGRESS'],
  new: ['NEW'],
  closed: ['DONE', 'CANCELED'],
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU', { hour12: false })
}

export function MobileMyTickets() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = new URLSearchParams(location.search)
  const initialBoardContext = useMemo(() => readBoardNavigationContextFromSearch(search), [location.search])
  const initialFilter = useMemo<FilterKey>(() => {
    const tab = (initialBoardContext?.tab || '').trim()
    return tab === 'new' || tab === 'closed' || tab === 'active' ? (tab as FilterKey) : 'active'
  }, [initialBoardContext?.tab])
  const [filter, setFilter] = useState<FilterKey>(initialFilter)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
  /** Тот же scope, что у board. */
  const pageScope = {
    linkedClientCompanyId: linkedClientCompanyId || undefined,
    companyId: companyId || undefined,
  }

  const techNoLinked = meQ.data?.role === 'TECHNICIAN' && !linkedClientCompanyId
  const techBoundDefaultsQ = useQuery({
    queryKey: ['technician-bound-defaults-my', meQ.data?.id],
    queryFn: () => api.getTechnicianBoundContexts(),
    enabled: !!meQ.data && meQ.data.role === 'TECHNICIAN' && !linkedClientCompanyId,
  })

  useEffect(() => {
    if (meQ.data?.role !== 'TECHNICIAN') return
    if (linkedClientCompanyId) return
    if (!techBoundDefaultsQ.isSuccess) return
    const picked = api.pickFirstTechnicianBoundLinkedClientCompanyId(techBoundDefaultsQ.data || [])
    if (!picked) return
    api.persistScopeFromSearchParams(new URLSearchParams({ linkedClientCompanyId: picked }), meQ.data)
    const nextPath = api.appendScopeToPath(
      location.pathname || mobilePath(location.pathname, '/my'),
      { linkedClientCompanyId: picked, companyId: companyId || undefined },
      meQ.data,
    )
    if (nextPath !== `${location.pathname}${location.search}`) {
      navigate(nextPath, { replace: true })
    }
  }, [
    meQ.data,
    linkedClientCompanyId,
    techBoundDefaultsQ.isSuccess,
    techBoundDefaultsQ.data,
    navigate,
    companyId,
    location.pathname,
    location.search,
  ])

  const boardQ = useQuery({
    queryKey: ['mobile-my-board', linkedClientCompanyId, companyId],
    queryFn: () =>
      api.board({
        linkedClientCompanyId: linkedClientCompanyId || undefined,
        companyId: companyId || undefined,
        take: 60,
      }),
    enabled:
      !!meQ.data && (meQ.data.role !== 'TECHNICIAN' || !!linkedClientCompanyId),
  })

  const allTickets = boardQ.data?.columns.flatMap((col) => col.cards || []) || []
  const mineScopedTickets = useMemo(
    () => allTickets.filter((ticket) => isMineTicketForRole(ticket, meQ.data?.id, meQ.data?.role)),
    [allTickets, meQ.data?.id, meQ.data?.role],
  )
  const statuses = filterMap[filter]
  const filteredTickets = useMemo(
    () => mineScopedTickets.filter((ticket) => statuses.includes(ticket.status)),
    [mineScopedTickets, statuses],
  )

  useEffect(() => {
    const basePath = api.appendScopeToPath(mobilePath(location.pathname, '/my'), pageScope, meQ.data)
    const nextPath = appendBoardNavigationContextToPath(basePath, { tab: filter, scopeLabel: 'Мои заявки' })
    if (nextPath !== `${location.pathname}${location.search}`) {
      navigate(nextPath, { replace: true, state: location.state })
    }
  }, [filter, pageScope.linkedClientCompanyId, pageScope.companyId, meQ.data, navigate, location.pathname, location.search, location.state])

  const ticketHref = (ticket: api.TicketCard) => {
    if (!meQ.data) return mobilePath(location.pathname, `/tickets/${ticket.id}`)
    const linkScope = scopeForMobileTicketLink(meQ.data, pageScope, ticket)
    const basePath = api.appendScopeToPath(mobilePath(location.pathname, `/tickets/${ticket.id}`), compactTicketScope(linkScope), meQ.data)
    return appendBoardNavigationContextToPath(basePath, { tab: filter, scopeLabel: 'Мои заявки' })
  }

  if (!meQ.data) {
    return (
      <div className="mobileSection">
        <div>
          <h1 className="mobileTitle">Мои заявки</h1>
          <div className="mobileSubtitle">Личный список без таблиц и desktop-плотности</div>
        </div>
        <div className="mobileCard mobileMeta">Загрузка…</div>
      </div>
    )
  }

  const techWillRedirectForScope =
    techNoLinked &&
    techBoundDefaultsQ.isSuccess &&
    (techBoundDefaultsQ.data?.length ?? 0) > 0

  const showMyTicketsList =
    !techNoLinked ||
    ((techBoundDefaultsQ.isFetched || techBoundDefaultsQ.isError) && !techWillRedirectForScope)

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Мои заявки</h1>
        <div className="mobileSubtitle">Личный список без таблиц и desktop-плотности</div>
        <MobileRoleContextStrip role={meQ.data.role} />
      </div>

      {meQ.data.role === 'TECHNICIAN' && !linkedClientCompanyId ? (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {techBoundDefaultsQ.isPending ? <div className="mobileNotice">Определяем клиентский контур…</div> : null}
          {techWillRedirectForScope ? <div className="mobileNotice">Подключаем клиентский контур…</div> : null}
          {techBoundDefaultsQ.isError ? (
            <div className="mobileNotice mobileNoticeError">
              {(techBoundDefaultsQ.error as any)?.message || String(techBoundDefaultsQ.error)}
            </div>
          ) : null}
          {!techBoundDefaultsQ.isPending &&
          !techBoundDefaultsQ.isError &&
          techBoundDefaultsQ.isSuccess &&
          (techBoundDefaultsQ.data?.length ?? 0) === 0 ? (
            <div
              className="mobileNotice"
              style={{
                border: '1px solid #fcd34d',
                background: '#fffbeb',
                color: '#92400e',
              }}
            >
              Не выбран клиентский контур
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mobileActionRow">
        <button
          className={filter === 'active' ? 'mobileBtn' : 'mobileBtn mobileBtnSecondary'}
          onClick={() => setFilter('active')}
        >
          Активные
        </button>
        <button
          className={filter === 'new' ? 'mobileBtn' : 'mobileBtn mobileBtnSecondary'}
          onClick={() => setFilter('new')}
        >
          Новые
        </button>
        <button
          className={filter === 'closed' ? 'mobileBtn' : 'mobileBtn mobileBtnSecondary'}
          onClick={() => setFilter('closed')}
        >
          Закрытые
        </button>
      </div>

      {boardQ.isError ? <div className="mobileNotice mobileNoticeError">{String((boardQ.error as any)?.message || boardQ.error)}</div> : null}

      {!showMyTicketsList ? null : filteredTickets.length === 0 ? (
        <div className="mobileCard mobileEmptyState" role="status">
          <div className="mobileEmptyStateTitle">Список пуст</div>
          <p className="mobileEmptyStateHint">
            {meQ.data.role === 'TECHNICIAN' && filter === 'new'
              ? 'Новых заявок на вас нет: они появятся после назначения или если вы возьмёте заявку с главной (вкладка «Новые»).'
              : meQ.data.role === 'TECHNICIAN' && filter === 'active'
                ? 'Нет активных заявок в этом контуре. Проверьте «Новые» на главной или фильтр «Закрытые».'
                : 'В этом фильтре заявок пока нет.'}
          </p>
        </div>
      ) : (
        filteredTickets.map((ticket) => (
          <Link
            key={ticket.id}
            to={ticketHref(ticket)}
            state={mobileTicketNavState('my', ticket.companyId)}
            className="mobileCard mobileCardClickable"
            style={{ display: 'block', padding: 12 }}
          >
            <div className="mobileRow">
              <strong>{mobileTicketNumberTitle(ticket.ticketNumber)}</strong>
              <span className="mobileMeta">{ticket.status}</span>
            </div>
            <div className="mobileMeta" style={{ marginTop: 6 }}>
              {mobileTicketCategoryLocationFromCard(ticket)}
            </div>
            <div className="mobileMeta" style={{ marginTop: 6 }}>
              Обновлено: {formatDate(ticket.createdAt)}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
