import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  compactTicketScope,
  mobileTicketCategoryLocationFromCard,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  mobileTicketStatusLabelRu,
  scopeForMobileTicketLink,
} from './mobileTicketDisplay'
import { MobileRoleContextStrip } from './MobileUxHints'
import { ticketsForMobileMyPage } from './mobileHomeBoardFilters'
import { appendBoardNavigationContextToPath, readBoardNavigationContextFromSearch } from '../lib/boardNavigationContext'
import { ticketMatchesMobileHomeSearch } from './mobileHomeListUtils'
import { mobilePath } from './mobileRoute'

type FilterKey = 'active' | 'new' | 'archive'

const filterMap: Record<FilterKey, api.TicketStatus[]> = {
  active: ['ASSIGNED', 'IN_PROGRESS'],
  new: ['NEW'],
  archive: ['DONE', 'CANCELED'],
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
    return tab === 'new' || tab === 'archive' || tab === 'active' ? (tab as FilterKey) : 'active'
  }, [initialBoardContext?.tab])
  const [filter, setFilter] = useState<FilterKey>(initialFilter)
  const [archiveSearch, setArchiveSearch] = useState(() => (initialBoardContext?.search || '').trim().slice(0, 240))

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
    queryKey: ['mobile-my-board', linkedClientCompanyId, companyId, filter],
    queryFn: () =>
      api.board({
        linkedClientCompanyId: linkedClientCompanyId || undefined,
        companyId: companyId || undefined,
        take: filter === 'archive' ? 200 : 60,
      }),
    enabled:
      !!meQ.data && (meQ.data.role !== 'TECHNICIAN' || !!linkedClientCompanyId),
  })

  const allTickets = boardQ.data?.columns.flatMap((col) => col.cards || []) || []
  const pageScopedTickets = useMemo(
    () => ticketsForMobileMyPage(allTickets, filter, meQ.data?.id, meQ.data?.role),
    [allTickets, filter, meQ.data?.id, meQ.data?.role],
  )
  const statuses = filterMap[filter]
  const filteredTickets = useMemo(() => {
    const byStatus = pageScopedTickets.filter((ticket) => statuses.includes(ticket.status))
    if (filter !== 'archive' || !archiveSearch.trim()) return byStatus
    return byStatus.filter((ticket) => ticketMatchesMobileHomeSearch(ticket, archiveSearch))
  }, [pageScopedTickets, statuses, filter, archiveSearch])

  useEffect(() => {
    const basePath = api.appendScopeToPath(mobilePath(location.pathname, '/my'), pageScope, meQ.data)
    const nextPath = appendBoardNavigationContextToPath(basePath, {
      tab: filter,
      scopeLabel: 'Мои заявки',
      search: filter === 'archive' && archiveSearch.trim() ? archiveSearch.trim() : undefined,
    })
    if (nextPath !== `${location.pathname}${location.search}`) {
      navigate(nextPath, { replace: true, state: location.state })
    }
  }, [filter, archiveSearch, pageScope.linkedClientCompanyId, pageScope.companyId, meQ.data, navigate, location.pathname, location.search, location.state])

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
          className={filter === 'archive' ? 'mobileBtn' : 'mobileBtn mobileBtnSecondary'}
          onClick={() => { setFilter('archive'); setArchiveSearch('') }}
        >
          Архив
        </button>
      </div>

      {filter === 'archive' ? (
        <label className="mobileHomeSearchWrap" style={{ marginTop: 8 }}>
          <span className="mobileVisuallyHidden">Поиск по архиву</span>
          <input
            className="mobileHomeSearchInput"
            type="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Поиск: номер, адрес, точка, проблема"
            value={archiveSearch}
            onChange={(e) => setArchiveSearch(e.target.value.slice(0, 240))}
          />
        </label>
      ) : null}

      {boardQ.isError ? <div className="mobileNotice mobileNoticeError">{String((boardQ.error as any)?.message || boardQ.error)}</div> : null}

      {!showMyTicketsList ? null : filteredTickets.length === 0 ? (
        <div className="mobileCard mobileEmptyState" role="status">
          <div className="mobileEmptyStateTitle">{filter === 'archive' ? 'В архиве пока нет заявок' : 'Список пуст'}</div>
          <p className="mobileEmptyStateHint">
            {filter === 'archive'
              ? archiveSearch.trim()
                ? 'По этому запросу в архиве ничего не найдено. Проверьте номер или сбросьте поиск.'
                : 'Здесь заявки со статусом «Выполнена» и «Отменена».'
              : meQ.data.role === 'TECHNICIAN' && filter === 'new'
              ? 'Новых заявок на вас нет: они появятся после назначения или если вы возьмёте заявку с главной (вкладка «Новые»).'
              : meQ.data.role === 'TECHNICIAN' && filter === 'active'
                ? 'Нет активных заявок в этом контуре. Проверьте «Новые» на главной или вкладку «Архив».'
                : 'В этом фильтре заявок пока нет.'}
          </p>
        </div>
      ) : (
        filteredTickets.map((ticket) => (
          <Link
            key={ticket.id}
            to={ticketHref(ticket)}
            state={mobileTicketNavState('my', ticket.companyId)}
            className="mobileCard mobileCardClickable mobileMyTicketCard"
          >
            <div className="mobileMyTicketThumb" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div className="mobileMyTicketInfo">
              <div className="mobileRow">
                <strong>{mobileTicketNumberTitle(ticket.ticketNumber)}</strong>
                <span className={`mobileTicketStatus mobileTicketStatus--${ticket.status}`}>{mobileTicketStatusLabelRu(ticket.status)}</span>
              </div>
              <div className="mobileMeta mobileTicketCardObject" style={{ marginTop: 4 }}>
                {mobileTicketCategoryLocationFromCard(ticket)}
              </div>
              <div className="mobileMeta" style={{ marginTop: 4 }}>
                {formatDate(ticket.createdAt)}
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
