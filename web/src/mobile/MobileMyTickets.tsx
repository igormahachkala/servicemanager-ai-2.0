import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import { TicketCard } from './home/TicketCard'
import {
  compactTicketScope,
  mobileTicketNavState,
  scopeForMobileTicketLink,
} from './mobileTicketDisplay'
import { MobileRoleContextStrip } from './MobileUxHints'
import { ticketsForMobileMyPage } from './mobileHomeBoardFilters'
import { appendBoardNavigationContextToPath, readBoardNavigationContextFromSearch } from '../lib/boardNavigationContext'
import { ticketMatchesMobileHomeSearch } from './mobileHomeListUtils'
import { mobilePath } from './mobileRoute'

type FilterKey = 'active' | 'done' | 'archive'

function ticketLinkState(ticketCompanyId?: string | null) {
  return mobileTicketNavState('my', ticketCompanyId || undefined)
}

const filterStatuses: Partial<Record<FilterKey, api.TicketStatus[]>> = {
  active: ['NEW', 'ASSIGNED', 'IN_PROGRESS'],
  done: ['DONE'],
  archive: ['CANCELED'],
}

const SEGMENT_LABELS: Record<FilterKey, string> = {
  active: 'Активные',
  done: 'Завершённые',
  archive: 'Архив',
}

const SEGMENTS: FilterKey[] = ['active', 'done', 'archive']

export function MobileMyTickets() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = new URLSearchParams(location.search)
  const initialBoardContext = useMemo(() => readBoardNavigationContextFromSearch(search), [location.search])
  const initialFilter = useMemo<FilterKey>(() => {
    const tab = (initialBoardContext?.tab || '').trim()
    return (SEGMENTS as string[]).includes(tab) ? (tab as FilterKey) : 'active'
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
        take: filter === 'active' ? 100 : 200,
      }),
    enabled:
      !!meQ.data && (meQ.data.role !== 'TECHNICIAN' || !!linkedClientCompanyId),
  })

  const allTickets = boardQ.data?.columns.flatMap((col) => col.cards || []) || []
  const pageScopedTickets = useMemo(
    () => ticketsForMobileMyPage(allTickets, filter === 'active' ? 'active' : 'archive', meQ.data?.id, meQ.data?.role),
    [allTickets, filter, meQ.data?.id, meQ.data?.role],
  )
  const filteredTickets = useMemo(() => {
    let result = pageScopedTickets
    const statuses = filterStatuses[filter]
    if (statuses) result = result.filter((t) => statuses.includes(t.status))
    if (filter !== 'active' && archiveSearch.trim()) {
      result = result.filter((t) => ticketMatchesMobileHomeSearch(t, archiveSearch))
    }
    return result
  }, [pageScopedTickets, filter, archiveSearch])

  useEffect(() => {
    const basePath = api.appendScopeToPath(mobilePath(location.pathname, '/my'), pageScope, meQ.data)
    const nextPath = appendBoardNavigationContextToPath(basePath, {
      tab: filter,
      scopeLabel: 'Мои заявки',
      search: filter !== 'active' && archiveSearch.trim() ? archiveSearch.trim() : undefined,
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
          <h1 className="mobileTitle">Заявки</h1>
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
      <div style={{ marginBottom: 4 }}>
        <h1 className="mobileTitle">Заявки</h1>
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

      <div className="mobileSegments">
        {SEGMENTS.map((seg) => (
          <button
            key={seg}
            type="button"
            className={`mobileSegmentBtn${filter === seg ? ' mobileSegmentBtn--active' : ''}`}
            onClick={() => { setFilter(seg); if (seg === 'active') setArchiveSearch('') }}
          >
            {SEGMENT_LABELS[seg]}
          </button>
        ))}
      </div>

      {filter !== 'active' ? (
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
          <div className="mobileEmptyStateTitle">
            {filter === 'done' ? 'Завершённых заявок нет' : filter === 'archive' ? 'В архиве пока нет заявок' : 'Список пуст'}
          </div>
          <p className="mobileEmptyStateHint">
            {filter === 'done'
              ? archiveSearch.trim()
                ? 'По этому запросу ничего не найдено.'
                : 'Здесь появятся завершённые заявки.'
              : filter === 'archive'
              ? archiveSearch.trim()
                ? 'По этому запросу в архиве ничего не найдено. Проверьте номер или сбросьте поиск.'
                : 'Здесь отменённые заявки.'
              : meQ.data.role === 'TECHNICIAN'
                ? 'Нет активных заявок в этом контуре. Проверьте главную страницу.'
                : 'Активных заявок пока нет.'}
          </p>
        </div>
      ) : (
        filteredTickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            ticketHref={ticketHref(ticket)}
            linkState={ticketLinkState(ticket.companyId)}
          />
        ))
      )}
    </div>
  )
}
