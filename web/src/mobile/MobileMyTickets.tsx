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
import { MobileInspectionList } from './MobileInspectionList'

type FilterKey = 'active' | 'done' | 'archive'

type AdvancedFilters = {
  location: string
  categoryId: string
  priority: string
  period: string
}

function ticketLinkState(ticketCompanyId?: string | null) {
  return mobileTicketNavState('my', ticketCompanyId || undefined)
}

const filterStatuses: Partial<Record<FilterKey, api.TicketStatus[]>> = {
  active: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE'],
  done: ['DONE'],
  archive: ['CANCELED'],
}

const SEGMENT_LABELS: Record<FilterKey, string> = {
  active: 'Активные',
  done: 'Завершённые',
  archive: 'Архив',
}

const SEGMENTS: FilterKey[] = ['active', 'done', 'archive']

const DEFAULT_ADV_FILTERS: AdvancedFilters = { location: '', categoryId: '', priority: '', period: '' }

function ticketLocationKey(t: api.TicketCard): string {
  return (t.location?.id || t.pointName || '').trim()
}

function ticketLocationLabel(t: api.TicketCard): string {
  return (t.location?.name || t.pointName || '').trim()
}

function isTicketInPeriod(t: api.TicketCard, period: string): boolean {
  if (!period) return true
  const created = new Date(t.createdAt).getTime()
  if (Number.isNaN(created)) return true
  const now = Date.now()
  if (period === 'today') {
    const d = new Date(created)
    const today = new Date()
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  }
  if (period === '7d') return now - created <= 7 * 24 * 60 * 60 * 1000
  if (period === '30d') return now - created <= 30 * 24 * 60 * 60 * 1000
  return true
}

const PERIOD_LABELS: Record<string, string> = { today: 'Сегодня', '7d': '7 дней', '30d': '30 дней' }
const PRIORITY_LABELS: Record<string, string> = { NORMAL: 'Обычный', URGENT: 'Срочный' }

type ScreenMode = 'tickets' | 'patrols'

export function MobileMyTickets() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = new URLSearchParams(location.search)
  const [screenMode, setScreenMode] = useState<ScreenMode>('tickets')
  const initialBoardContext = useMemo(() => readBoardNavigationContextFromSearch(search), [location.search])
  const initialFilter = useMemo<FilterKey>(() => {
    const tab = (initialBoardContext?.tab || '').trim()
    return (SEGMENTS as string[]).includes(tab) ? (tab as FilterKey) : 'active'
  }, [initialBoardContext?.tab])
  const [filter, setFilter] = useState<FilterKey>(initialFilter)
  const [textSearch, setTextSearch] = useState(() => (initialBoardContext?.search || '').trim().slice(0, 240))
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(DEFAULT_ADV_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
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

  const myTicketsTabCounts = useMemo(() => {
    const activeScope = ticketsForMobileMyPage(allTickets, 'active', meQ.data?.id, meQ.data?.role)
    const archiveScope = ticketsForMobileMyPage(allTickets, 'archive', meQ.data?.id, meQ.data?.role)
    return {
      active: activeScope.filter((t) => filterStatuses.active!.includes(t.status)).length,
      done: archiveScope.filter((t) => filterStatuses.done!.includes(t.status)).length,
      archive: archiveScope.filter((t) => filterStatuses.archive!.includes(t.status)).length,
    }
  }, [allTickets, meQ.data?.id, meQ.data?.role])

  const statusFilteredTickets = useMemo(() => {
    const statuses = filterStatuses[filter]
    return statuses ? pageScopedTickets.filter((t) => statuses.includes(t.status)) : pageScopedTickets
  }, [pageScopedTickets, filter])

  const locationOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: { id: string; label: string }[] = []
    for (const t of statusFilteredTickets) {
      const id = ticketLocationKey(t)
      const label = ticketLocationLabel(t)
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push({ id, label: label || id })
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [statusFilteredTickets])

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: { id: string; label: string }[] = []
    for (const t of statusFilteredTickets) {
      const id = (t.category?.id || '').trim()
      const label = (t.category?.name || '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push({ id, label: label || id })
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }, [statusFilteredTickets])

  const filteredTickets = useMemo(() => {
    let result = statusFilteredTickets
    if (textSearch.trim()) result = result.filter((t) => ticketMatchesMobileHomeSearch(t, textSearch))
    if (advFilters.location) result = result.filter((t) => ticketLocationKey(t) === advFilters.location)
    if (advFilters.categoryId) result = result.filter((t) => (t.category?.id || '').trim() === advFilters.categoryId)
    if (advFilters.priority) result = result.filter((t) => (t.priority ?? 'NORMAL') === advFilters.priority)
    if (advFilters.period) result = result.filter((t) => isTicketInPeriod(t, advFilters.period))
    return result
  }, [statusFilteredTickets, textSearch, advFilters])

  const hasAdvancedFilters =
    !!textSearch.trim() ||
    !!advFilters.location ||
    !!advFilters.categoryId ||
    !!advFilters.priority ||
    !!advFilters.period

  function resetAdvancedFilters() {
    setTextSearch('')
    setAdvFilters(DEFAULT_ADV_FILTERS)
  }

  useEffect(() => {
    const basePath = api.appendScopeToPath(mobilePath(location.pathname, '/my'), pageScope, meQ.data)
    const nextPath = appendBoardNavigationContextToPath(basePath, {
      tab: filter,
      scopeLabel: 'Мои заявки',
      search: textSearch.trim() ? textSearch.trim() : undefined,
    })
    if (nextPath !== `${location.pathname}${location.search}`) {
      navigate(nextPath, { replace: true, state: location.state })
    }
  }, [filter, textSearch, pageScope.linkedClientCompanyId, pageScope.companyId, meQ.data, navigate, location.pathname, location.search, location.state])

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

      {/* Top-level mode switcher */}
      <div className="mobileScreenTabs">
        <button
          type="button"
          className={`mobileScreenTab${screenMode === 'tickets' ? ' mobileScreenTab--active' : ''}`}
          onClick={() => setScreenMode('tickets')}
        >
          Заявки
        </button>
        <button
          type="button"
          className={`mobileScreenTab${screenMode === 'patrols' ? ' mobileScreenTab--active' : ''}`}
          onClick={() => setScreenMode('patrols')}
        >
          Обходы
        </button>
      </div>

      {screenMode === 'patrols' ? (
        <MobileInspectionList />
      ) : (
      <>

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
            <div className="mobileNotice" style={{ border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e' }}>
              Не выбран клиентский контур
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Segment tabs + filter toggle */}
      <div className="mobileMyTicketsControls">
        <div className="mobileSegments">
          {SEGMENTS.map((seg) => {
            const count = myTicketsTabCounts[seg]
            return (
              <button
                key={seg}
                type="button"
                className={`mobileSegmentBtn${filter === seg ? ' mobileSegmentBtn--active' : ''}`}
                onClick={() => {
                  setFilter(seg)
                  if (seg === 'active') setTextSearch('')
                  setAdvFilters(DEFAULT_ADV_FILTERS)
                }}
              >
                {SEGMENT_LABELS[seg]}
                {boardQ.isSuccess && count > 0 ? (
                  <span className="mobileSegmentBtnBadge">{count}</span>
                ) : null}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className={`mobileFiltersToggleBtn${filtersOpen || hasAdvancedFilters ? ' mobileFiltersToggleBtn--active' : ''}`}
          onClick={() => setFiltersOpen((p) => !p)}
        >
          {hasAdvancedFilters && !filtersOpen ? <span className="mobileFiltersToggleDot" /> : null}
          Фильтры
        </button>
      </div>

      {/* Advanced filter panel */}
      {filtersOpen ? (
        <div className="mobileFiltersPanel">
          <div className="mobileFiltersPanelHeader">
            <span className="mobileFiltersPanelTitle">Фильтры</span>
            <button
              type="button"
              className="mobileBtn mobileBtnSecondary"
              style={{ fontSize: '0.78rem', padding: '4px 12px', minHeight: 30 }}
              onClick={resetAdvancedFilters}
              disabled={!hasAdvancedFilters}
            >
              Сбросить
            </button>
          </div>
          <div className="mobileFiltersPanelBody">
            {/* Text search */}
            <label className="mobileHomeSearchWrap" style={{ margin: 0 }}>
              <span className="mobileVisuallyHidden">Поиск заявок</span>
              <input
                className="mobileHomeSearchInput"
                type="search"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Поиск: номер, адрес, точка, проблема"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value.slice(0, 240))}
              />
            </label>

            {/* Location */}
            {locationOptions.length > 1 ? (
              <div>
                <div className="mobileAdvFilterLabel">Объект</div>
                <select
                  className="mobileFilterSelect"
                  value={advFilters.location}
                  onChange={(e) => setAdvFilters((p) => ({ ...p, location: e.target.value }))}
                >
                  <option value="">Все объекты</option>
                  {locationOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Category */}
            {categoryOptions.length > 1 ? (
              <div>
                <div className="mobileAdvFilterLabel">Категория</div>
                <select
                  className="mobileFilterSelect"
                  value={advFilters.categoryId}
                  onChange={(e) => setAdvFilters((p) => ({ ...p, categoryId: e.target.value }))}
                >
                  <option value="">Все категории</option>
                  {categoryOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Priority */}
            <div>
              <div className="mobileAdvFilterLabel">Приоритет</div>
              <div className="mobileChipRow" role="group" aria-label="Приоритет">
                {(['', 'NORMAL', 'URGENT'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`mobileFilterChip${advFilters.priority === p ? ' mobileFilterChipActive' : ''}`}
                    aria-pressed={advFilters.priority === p}
                    onClick={() => setAdvFilters((prev) => ({ ...prev, priority: prev.priority === p ? '' : p }))}
                  >
                    {p === '' ? 'Все' : PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div>
              <div className="mobileAdvFilterLabel">Период</div>
              <div className="mobileChipRow" role="group" aria-label="Период">
                {(['', 'today', '7d', '30d'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`mobileFilterChip${advFilters.period === p ? ' mobileFilterChipActive' : ''}`}
                    aria-pressed={advFilters.period === p}
                    onClick={() => setAdvFilters((prev) => ({ ...prev, period: prev.period === p ? '' : p }))}
                  >
                    {p === '' ? 'Все' : PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mobileRow" style={{ paddingTop: 2 }}>
              <span className="mobileMeta">Найдено: <strong>{filteredTickets.length}</strong></span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Active filter chips (panel closed) */}
      {hasAdvancedFilters && !filtersOpen ? (
        <div className="mobileActiveFilterChips">
          {textSearch.trim() ? (
            <span className="mobileActiveFilterChip">
              {textSearch.length > 20 ? `${textSearch.slice(0, 20)}…` : textSearch}
              <button type="button" className="mobileActiveFilterChipX" onClick={() => setTextSearch('')} aria-label="Убрать поиск">×</button>
            </span>
          ) : null}
          {advFilters.location ? (
            <span className="mobileActiveFilterChip">
              {locationOptions.find((o) => o.id === advFilters.location)?.label || advFilters.location}
              <button type="button" className="mobileActiveFilterChipX" onClick={() => setAdvFilters((p) => ({ ...p, location: '' }))} aria-label="Убрать объект">×</button>
            </span>
          ) : null}
          {advFilters.categoryId ? (
            <span className="mobileActiveFilterChip">
              {categoryOptions.find((o) => o.id === advFilters.categoryId)?.label || advFilters.categoryId}
              <button type="button" className="mobileActiveFilterChipX" onClick={() => setAdvFilters((p) => ({ ...p, categoryId: '' }))} aria-label="Убрать категорию">×</button>
            </span>
          ) : null}
          {advFilters.priority ? (
            <span className="mobileActiveFilterChip">
              {PRIORITY_LABELS[advFilters.priority] || advFilters.priority}
              <button type="button" className="mobileActiveFilterChipX" onClick={() => setAdvFilters((p) => ({ ...p, priority: '' }))} aria-label="Убрать приоритет">×</button>
            </span>
          ) : null}
          {advFilters.period ? (
            <span className="mobileActiveFilterChip">
              {PERIOD_LABELS[advFilters.period] || advFilters.period}
              <button type="button" className="mobileActiveFilterChipX" onClick={() => setAdvFilters((p) => ({ ...p, period: '' }))} aria-label="Убрать период">×</button>
            </span>
          ) : null}
        </div>
      ) : null}

      {boardQ.isError ? <div className="mobileNotice mobileNoticeError">{String((boardQ.error as any)?.message || boardQ.error)}</div> : null}

      {!showMyTicketsList ? null : filteredTickets.length === 0 ? (
        <div className="mobileCard mobileEmptyState" role="status">
          <div className="mobileEmptyStateTitle">
            {hasAdvancedFilters
              ? 'Ничего не найдено'
              : filter === 'done'
              ? 'Завершённых заявок нет'
              : filter === 'archive'
              ? 'В архиве пока нет заявок'
              : 'Нет активных заявок'}
          </div>
          <p className="mobileEmptyStateHint">
            {hasAdvancedFilters
              ? 'По выбранным фильтрам заявок не найдено. Попробуйте изменить или сбросить фильтры.'
              : filter === 'done'
              ? 'Здесь появятся завершённые заявки.'
              : filter === 'archive'
              ? 'Здесь отменённые заявки.'
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
      </>
      )}
    </div>
  )
}
