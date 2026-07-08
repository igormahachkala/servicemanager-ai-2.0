import { useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'
import { mobileTicketNumberTitle, mobileTicketStatusLabelRu } from './mobileTicketDisplay'

/**
 * Роли с доступом к /analytics/overview и /analytics/locations (backend RolesGuard).
 * Прочие роли (TECHNICIAN, CLIENT, ADMIN_PROVIDER, …) получают 403 → для них только
 * контекст по локациям (/tickets/analytics/context, доступен всем ролям).
 */
const ANALYTICS_ADMIN_ROLES = new Set<string>([
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'PLATFORM_ADMIN',
])

type AnalyticsPeriod = '7d' | '30d' | '90d' | '365d' | 'custom'

const PERIOD_CHIPS: Array<[AnalyticsPeriod, string]> = [
  ['7d', '7д'],
  ['30d', '30д'],
  ['90d', '90д'],
  ['365d', '365д'],
  ['custom', '…'],
]

const STATUS_FILTER: Array<[api.TicketStatus, string]> = [
  ['NEW', 'Новые'],
  ['ASSIGNED', 'Назначенные'],
  ['IN_PROGRESS', 'В работе'],
  ['AWAITING_ACCEPTANCE', 'На приёмке'],
  ['DONE', 'Выполненные'],
  ['CANCELED', 'Отменённые'],
]

/** Соответствие строки распределения статусу заявки (для фильтра статусов). */
const STATUS_ROW_CODE: Record<string, api.TicketStatus> = {
  new: 'NEW',
  assigned: 'ASSIGNED',
  inprogress: 'IN_PROGRESS',
  done: 'DONE',
}

function toggleInSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

type AnalyticsView = 'overview' | 'top-objects' | 'top-cats' | 'overdue' | 'contractors' | 'equipment'

const ANALYTICS_VIEWS: Array<[AnalyticsView, string]> = [
  ['overview', 'Обзор'],
  ['top-objects', 'ТОП объектов'],
  ['top-cats', 'ТОП категорий'],
  ['overdue', 'Просрочки'],
  ['contractors', 'Подрядчики'],
  ['equipment', 'Оборудование'],
]

/** Минуты → человекочитаемое «Ч ч» / «М мин». */
function fmtMinutes(min?: number | null): string {
  if (min == null || !Number.isFinite(min)) return '—'
  if (min < 60) return `${Math.round(min)} мин`
  return `${(min / 60).toFixed(1)} ч`
}

/** Диапазон дат для /analytics/locations (from/to = YYYY-MM-DD). Overview периода не поддерживает. */
function periodRange(period: AnalyticsPeriod, from: string, to: string): { from?: string; to?: string } {
  if (period === 'custom') return { from: from || undefined, to: to || undefined }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(start), to: iso(now) }
}

function periodLabelOf(period: AnalyticsPeriod, from: string, to: string): string {
  switch (period) {
    case '7d':
      return 'За 7 дней'
    case '30d':
      return 'За 30 дней'
    case '90d':
      return 'За 90 дней'
    case '365d':
      return 'За 365 дней'
    default:
      return from && to ? `${from} — ${to}` : 'Произвольный период'
  }
}

function TablerIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

const KpiIconTickets = (
  <TablerIcon>
    <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" />
    <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </TablerIcon>
)
const KpiIconOverdue = (
  <TablerIcon>
    <path d="M12 9v4" />
    <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
    <path d="M12 16h.01" />
  </TablerIcon>
)
const KpiIconDone = (
  <TablerIcon>
    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
    <path d="M9 12l2 2l4 -4" />
  </TablerIcon>
)
const KpiIconSla = (
  <TablerIcon>
    <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />
    <path d="M9 12l2 2l4 -4" />
  </TablerIcon>
)
const KpiIconActive = (
  <TablerIcon>
    <path d="M3 12h4l3 8l4 -16l3 8h4" />
  </TablerIcon>
)
const IconAdjustments = (
  <TablerIcon>
    <path d="M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 6l8 0" />
    <path d="M16 6l4 0" />
    <path d="M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 12l2 0" />
    <path d="M10 12l10 0" />
    <path d="M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    <path d="M4 18l11 0" />
    <path d="M19 18l1 0" />
  </TablerIcon>
)
const IconClose = (
  <TablerIcon>
    <path d="M18 6l-12 12" />
    <path d="M6 6l12 12" />
  </TablerIcon>
)

export function MobileAnalytics() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const role = meQ.data?.role
  const isAnalyticsAdmin = !!role && ANALYTICS_ADMIN_ROLES.has(role)

  // Период применяется к /analytics/locations (ADMIN). Overview/context дат не поддерживают.
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo])
  const periodLabel = periodLabelOf(period, customFrom, customTo)

  // Bottom-sheet «Параметры»: клиентские фильтры по уже загруженным locations-данным.
  const [filterOpen, setFilterOpen] = useState(false)
  const [selObjects, setSelObjects] = useState<Set<string>>(new Set())
  const [selCats, setSelCats] = useState<Set<string>>(new Set())
  const [selStatuses, setSelStatuses] = useState<Set<api.TicketStatus>>(new Set())
  const activeFilterCount = selObjects.size + selCats.size + selStatuses.size

  const resetFilters = () => {
    setSelObjects(new Set())
    setSelCats(new Set())
    setSelStatuses(new Set())
    setPeriod('30d')
    setCustomFrom('')
    setCustomTo('')
  }

  const linkedClientCompanyId = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return (sp.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  }, [location.search, meQ.data])
  const companyId = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return (sp.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
  }, [location.search, meQ.data])

  const scopeParams = {
    linkedClientCompanyId: linkedClientCompanyId || undefined,
    companyId: companyId || undefined,
  }

  // ── Overview (ADMIN-only) — SLA %, счётчики open-by-status, backlog ──
  const overviewQ = useQuery({
    queryKey: ['mobile-analytics-overview', linkedClientCompanyId, companyId],
    queryFn: () => api.analyticsOverview(scopeParams),
    enabled: !!meQ.data && isAnalyticsAdmin,
  })

  // ── Locations (ADMIN-only) — per-location + разбивка по категориям + done/overdue, за период ──
  const locationsQ = useQuery({
    queryKey: ['mobile-analytics-locations', linkedClientCompanyId, companyId, range.from, range.to],
    queryFn: () => api.analyticsLocations({ ...scopeParams, from: range.from, to: range.to }),
    enabled: !!meQ.data && isAnalyticsAdmin,
  })

  // ── Context (все роли) — счётчики заявок по локациям и оборудованию ──
  const contextQ = useQuery({
    queryKey: ['mobile-analytics-context', linkedClientCompanyId, companyId],
    queryFn: () => api.ticketContextAnalytics(scopeParams),
    enabled: !!meQ.data,
  })

  // Готовые представления (селектор). Board тянем лениво — только для «Просрочки».
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>('overview')
  const boardQ = useQuery({
    queryKey: ['mobile-analytics-overdue-board', linkedClientCompanyId, companyId],
    queryFn: () => api.board({ ...scopeParams, take: 500 }),
    enabled: !!meQ.data && isAnalyticsAdmin && analyticsView === 'overdue',
  })

  // Опции фильтров — из полного набора locations (не фильтрованного).
  const objectOptions = useMemo<Array<[string, string]>>(() => {
    const items = locationsQ.data?.items
    if (!items) return []
    return items.map((i) => [i.locationId, i.locationName] as [string, string])
  }, [locationsQ.data])

  const categoryOptions = useMemo<string[]>(() => {
    const items = locationsQ.data?.items
    if (!items) return []
    const set = new Set<string>()
    for (const loc of items) for (const c of loc.categories) set.add(c.categoryName)
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [locationsQ.data])

  // Locations, отфильтрованные по выбранным объектам (клиентски).
  const filteredItems = useMemo(() => {
    const items = locationsQ.data?.items ?? []
    return selObjects.size ? items.filter((i) => selObjects.has(i.locationId)) : items
  }, [locationsQ.data, selObjects])

  // Кол-во заявок точки в разрезе выбранных категорий (или всех, если категории не выбраны).
  const catScopedCount = (loc: api.LocationAnalyticsItem): number => {
    if (!selCats.size) return loc.totalTickets
    return loc.categories.filter((c) => selCats.has(c.categoryName)).reduce((s, c) => s + c.ticketsCount, 0)
  }
  const catScopedOverdue = (loc: api.LocationAnalyticsItem): number => {
    if (!selCats.size) return loc.overdueTickets
    return loc.categories.filter((c) => selCats.has(c.categoryName)).reduce((s, c) => s + c.overdueCount, 0)
  }

  // KPI: админ — счётчики из объекто/категорийно-фильтрованных locations + SLA% из overview
  // (без периода/фильтров); прочие — из context (фильтров нет).
  const kpi = useMemo(() => {
    if (isAnalyticsAdmin) {
      if (!locationsQ.data) return { total: null, overdue: null, done: null, slaPercent: overviewQ.data?.sla?.okPercent ?? null }
      let total = 0
      let overdue = 0
      let done = 0
      for (const i of filteredItems) {
        total += catScopedCount(i)
        overdue += catScopedOverdue(i)
        done += selCats.size ? 0 : i.doneTickets // «Выполнено» в разрезе категорий недоступно (нет split)
      }
      return {
        total,
        overdue,
        done: selCats.size ? null : done,
        slaPercent: overviewQ.data?.sla?.okPercent ?? null,
      }
    }
    const ctx = contextQ.data
    if (!ctx) return { active: null, done: null, total: null }
    let active = 0
    let done = 0
    for (const l of ctx.byLocation) {
      active += l.NEW + l.IN_PROGRESS
      done += l.DONE
    }
    return { active, done, total: ctx.meta.totalTickets }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyticsAdmin, overviewQ.data, locationsQ.data, contextQ.data, filteredItems, selCats])

  // Топ категорий (ADMIN) — агрегат по объекто-фильтрованным локациям, с учётом фильтра категорий.
  const topCategories = useMemo<Array<[string, number]>>(() => {
    if (!locationsQ.data) return []
    const map = new Map<string, number>()
    for (const loc of filteredItems) {
      for (const c of loc.categories) {
        if (selCats.size && !selCats.has(c.categoryName)) continue
        map.set(c.categoryName, (map.get(c.categoryName) || 0) + c.ticketsCount)
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [locationsQ.data, filteredItems, selCats])

  // Точки с наибольшим числом заявок (ADMIN → locations с учётом фильтров, прочие → context).
  const topLocations = useMemo<Array<[string, number]>>(() => {
    if (isAnalyticsAdmin) {
      if (!locationsQ.data) return []
      return filteredItems
        .map((l) => [l.locationName, selCats.size ? catScopedCount(l) : l.newTickets + l.inProgressTickets] as [string, number])
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    }
    const byLoc = contextQ.data?.byLocation
    if (!byLoc) return []
    return byLoc
      .map((l) => [l.locationName, l.NEW + l.IN_PROGRESS] as [string, number])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyticsAdmin, locationsQ.data, contextQ.data, filteredItems, selCats])

  // ТОП объектов (представление): все отфильтрованные локации, сортировка по числу заявок.
  const topObjects = useMemo(() => {
    return [...filteredItems]
      .map((l) => ({ id: l.locationId, name: l.locationName, total: catScopedCount(l), overdue: catScopedOverdue(l) }))
      .filter((o) => o.total > 0)
      .sort((a, b) => b.total - a.total)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems, selCats])

  // Просрочки (представление): board-карточки со slaBreached, ПОЛНОСТЬЮ фильтр-aware.
  const overdueTickets = useMemo(() => {
    const cols = boardQ.data?.columns ?? []
    const out: api.TicketCard[] = []
    for (const col of cols) {
      for (const c of col.cards) {
        if (!c.slaBreached) continue
        if (selObjects.size && !(c.location?.id && selObjects.has(c.location.id))) continue
        if (selCats.size && !(c.category?.name && selCats.has(c.category.name))) continue
        if (selStatuses.size && !selStatuses.has(c.status)) continue
        out.push(c)
      }
    }
    return out
  }, [boardQ.data, selObjects, selCats, selStatuses])

  // Распределение по статусам (ADMIN — 4 строки incl. Назначенные; прочие — 3 из context).
  const statusRows = useMemo(() => {
    if (isAnalyticsAdmin) {
      const open = overviewQ.data?.openByStatus
      const done = locationsQ.data?.summary?.doneTotal
      return [
        { label: 'Новые', value: open?.NEW ?? null, mod: 'new' },
        { label: 'Назначенные', value: open?.ASSIGNED ?? null, mod: 'assigned' },
        { label: 'В работе', value: open?.IN_PROGRESS ?? null, mod: 'inprogress' },
        { label: 'Выполненные', value: done ?? null, mod: 'done' },
      ] as const
    }
    const ctx = contextQ.data
    let n = 0
    let ip = 0
    let d = 0
    if (ctx) {
      for (const l of ctx.byLocation) {
        n += l.NEW
        ip += l.IN_PROGRESS
        d += l.DONE
      }
    }
    return [
      { label: 'Новые', value: ctx ? n : null, mod: 'new' },
      { label: 'В работе', value: ctx ? ip : null, mod: 'inprogress' },
      { label: 'Выполненные', value: ctx ? d : null, mod: 'done' },
    ] as const
  }, [isAnalyticsAdmin, overviewQ.data, locationsQ.data, contextQ.data])

  // Фильтр статусов применяется к строкам распределения (ADMIN).
  const visibleStatusRows = useMemo(() => {
    if (!isAnalyticsAdmin || !selStatuses.size) return statusRows
    return statusRows.filter((r) => {
      const code = STATUS_ROW_CODE[r.mod]
      return code ? selStatuses.has(code) : false
    })
  }, [isAnalyticsAdmin, statusRows, selStatuses])

  const scope = scopeParams
  const homeHref = api.appendScopeToPath(mobilePath(location.pathname, ''), scope, meQ.data)

  const fmt = (n: number | null | undefined) => (n == null ? '—' : String(n))
  const maxCat = topCategories[0]?.[1] || 1
  const maxLoc = topLocations[0]?.[1] || 1
  const statusMax = Math.max(1, ...visibleStatusRows.map((r) => r.value ?? 0))
  const pct = (n: number, max: number) => Math.round((n / max) * 100)

  // Загрузка KPI: у админа счётчики из locations, SLA — из overview.
  const kpiLoading = isAnalyticsAdmin ? locationsQ.isLoading : contextQ.isLoading

  const subtitle = isAnalyticsAdmin
    ? activeFilterCount > 0
      ? `${periodLabel} · ${activeFilterCount} фильтр${activeFilterCount === 1 ? '' : activeFilterCount < 5 ? 'а' : 'ов'}`
      : periodLabel
    : 'Сводка по текущему контуру заявок'

  return (
    <div className="mobileSection">
      <div className="mobileAnalyticsHead">
        <div>
          <h1 className="mobileTitle">Аналитика</h1>
          <div className="mobileSubtitle">{subtitle}</div>
        </div>
        {isAnalyticsAdmin ? (
          <button
            type="button"
            className={`mobileAnalyticsFilterBtn${activeFilterCount > 0 ? ' mobileAnalyticsFilterBtn--active' : ''}`}
            onClick={() => setFilterOpen(true)}
            aria-label="Параметры аналитики"
          >
            {IconAdjustments}
          </button>
        ) : null}
      </div>

      {/* Период (только ADMIN — /analytics/locations поддерживает from/to) */}
      {isAnalyticsAdmin ? (
        <>
          <div className="mobileAnalyticsPeriodRow">
            {PERIOD_CHIPS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`mobileAnalyticsPeriodChip${period === key ? ' mobileAnalyticsPeriodChip--active' : ''}`}
                onClick={() => setPeriod(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' ? (
            <div className="mobileAnalyticsCustomRow">
              <input
                type="date"
                className="mobileAnalyticsDateInput"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="Дата с"
              />
              <input
                type="date"
                className="mobileAnalyticsDateInput"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Дата по"
              />
            </div>
          ) : null}
        </>
      ) : null}

      {/* KPI */}
      <div className="mobileAnalyticsGrid">
        {isAnalyticsAdmin ? (
          <>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--active">
              <div className="mobileAnalyticsCardIcon">{KpiIconTickets}</div>
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.total)}</div>
              <div className="mobileAnalyticsLabel">Заявок за период</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--overdue">
              <div className="mobileAnalyticsCardIcon">{KpiIconOverdue}</div>
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.overdue)}</div>
              <div className="mobileAnalyticsLabel">Просрочено</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--done">
              <div className="mobileAnalyticsCardIcon">{KpiIconDone}</div>
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.done)}</div>
              <div className="mobileAnalyticsLabel">Выполнено</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--sla">
              <div className="mobileAnalyticsCardIcon">{KpiIconSla}</div>
              <div className="mobileAnalyticsValue">
                {overviewQ.isLoading ? '…' : kpi.slaPercent == null ? '—' : `${kpi.slaPercent}%`}
              </div>
              <div className="mobileAnalyticsLabel">SLA соблюдён</div>
            </div>
          </>
        ) : (
          <>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--active">
              <div className="mobileAnalyticsCardIcon">{KpiIconActive}</div>
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.active)}</div>
              <div className="mobileAnalyticsLabel">Активные заявки</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--done">
              <div className="mobileAnalyticsCardIcon">{KpiIconDone}</div>
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.done)}</div>
              <div className="mobileAnalyticsLabel">Выполнено</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--total">
              <div className="mobileAnalyticsCardIcon">{KpiIconTickets}</div>
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.total)}</div>
              <div className="mobileAnalyticsLabel">Всего заявок</div>
            </div>
          </>
        )}
      </div>

      {/* SLA/сроки период не учитывают — честная пометка */}
      {isAnalyticsAdmin ? (
        <div className="mobileAnalyticsSlaNote">SLA соблюдён — за всё окно, период не применяется.</div>
      ) : null}

      {/* Ошибки запросов — не ломают экран, показываем баннером */}
      {isAnalyticsAdmin && overviewQ.isError ? (
        <div className="mobileNotice mobileNoticeError">
          Не удалось загрузить обзор. {String((overviewQ.error as any)?.message || '')}
        </div>
      ) : null}
      {isAnalyticsAdmin && locationsQ.isError ? (
        <div className="mobileNotice mobileNoticeError">
          Не удалось загрузить данные по точкам. {String((locationsQ.error as any)?.message || '')}
        </div>
      ) : null}
      {!isAnalyticsAdmin && contextQ.isError ? (
        <div className="mobileNotice mobileNoticeError">
          Не удалось загрузить аналитику. {String((contextQ.error as any)?.message || '')}
        </div>
      ) : null}

      {/* Для не-админа: обзор (SLA, сроки, нагрузка) недоступен */}
      {!isAnalyticsAdmin && meQ.data ? (
        <div className="mobileCard">
          <div className="mobileMeta">Обзор (SLA, сроки, нагрузка) доступен администратору.</div>
        </div>
      ) : null}

      {/* ADMIN: селектор готовых представлений + переключаемое тело */}
      {isAnalyticsAdmin ? (
        <>
          <div className="mobileAnalyticsViewSelectWrap">
            <select
              className="mobileAnalyticsViewSelect"
              value={analyticsView}
              onChange={(e) => setAnalyticsView(e.target.value as AnalyticsView)}
              aria-label="Готовое представление"
            >
              {ANALYTICS_VIEWS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Обзор — сроки + распределение по статусам */}
          {analyticsView === 'overview' ? (
            <>
              <div className="mobileCard">
                <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Сроки</div>
                <div className="mobileAnalyticsTiming">
                  <div>
                    <div className="mobileAnalyticsTimingVal">{fmtMinutes(overviewQ.data?.timing?.meanTimeToAssignMinutes)}</div>
                    <div className="mobileAnalyticsTimingLabel">Ср. время назначения</div>
                  </div>
                  <div>
                    <div className="mobileAnalyticsTimingVal">{fmtMinutes(overviewQ.data?.timing?.meanTimeToResolveMinutes)}</div>
                    <div className="mobileAnalyticsTimingLabel">Ср. время решения</div>
                  </div>
                </div>
                <div className="mobileMeta" style={{ marginTop: 8 }}>Сроки — за всё окно (период/фильтры не применяются).</div>
              </div>

              <div className="mobileCard">
                <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Распределение по статусам</div>
                {visibleStatusRows.length > 0 ? (
                  <div className="mobileAnalyticsBarRows">
                    {visibleStatusRows.map(({ label, value, mod }) => (
                      <div key={mod} className="mobileAnalyticsBarRow">
                        <span className="mobileAnalyticsBarName">{label}</span>
                        <span className="mobileAnalyticsBarCount">{fmt(value)}</span>
                        <div className="mobileAnalyticsBarTrack">
                          <div className={`mobileAnalyticsBarFill mobileAnalyticsBarFill--${mod}`} style={{ width: `${value == null ? 0 : pct(value, statusMax)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mobileMeta">Нет строк для выбранных статусов.</div>
                )}
              </div>
            </>
          ) : null}

          {/* ТОП объектов */}
          {analyticsView === 'top-objects' ? (
            <div className="mobileCard">
              <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>ТОП объектов</div>
              {locationsQ.isSuccess && topObjects.length > 0 ? (
                <div className="mobileAnalyticsBarRows">
                  {topObjects.map((o) => (
                    <div key={o.id} className="mobileAnalyticsBarRow">
                      <span className="mobileAnalyticsBarName">{o.name}</span>
                      <span className="mobileAnalyticsBarCount">
                        {o.total}
                        {o.overdue > 0 ? <span className="mobileAnalyticsBarSub"> · {o.overdue} просроч.</span> : null}
                      </span>
                      <div className="mobileAnalyticsBarTrack">
                        <div className="mobileAnalyticsBarFill mobileAnalyticsBarFill--location" style={{ width: `${pct(o.total, topObjects[0].total || 1)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mobileMeta">{locationsQ.isLoading ? 'Загрузка…' : 'Нет данных'}</div>
              )}
            </div>
          ) : null}

          {/* ТОП категорий */}
          {analyticsView === 'top-cats' ? (
            <div className="mobileCard">
              <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>ТОП категорий</div>
              {locationsQ.isSuccess && topCategories.length > 0 ? (
                <div className="mobileAnalyticsBarRows">
                  {topCategories.map(([name, count]) => (
                    <div key={name} className="mobileAnalyticsBarRow">
                      <span className="mobileAnalyticsBarName">{name}</span>
                      <span className="mobileAnalyticsBarCount">{count}</span>
                      <div className="mobileAnalyticsBarTrack">
                        <div className="mobileAnalyticsBarFill" style={{ width: `${pct(count, maxCat)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mobileMeta">{locationsQ.isLoading ? 'Загрузка…' : 'Нет данных'}</div>
              )}
            </div>
          ) : null}

          {/* Просрочки — board-карточки slaBreached, фильтр-aware */}
          {analyticsView === 'overdue' ? (
            <div className="mobileCard">
              <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Просрочки</div>
              {boardQ.isLoading ? (
                <div className="mobileMeta">Загрузка…</div>
              ) : boardQ.isError ? (
                <div className="mobileMeta">Не удалось загрузить список просрочек.</div>
              ) : overdueTickets.length > 0 ? (
                <div className="mobileAnalyticsOverdueList">
                  {overdueTickets.map((t) => (
                    <div key={t.id} className="mobileAnalyticsOverdueRow">
                      <div className="mobileAnalyticsOverdueTop">
                        <span className="mobileAnalyticsOverdueNum">{mobileTicketNumberTitle(t.ticketNumber)}</span>
                        <span className={`mobileTicketStatus mobileTicketStatus--${t.status}`}>{mobileTicketStatusLabelRu(t.status)}</span>
                      </div>
                      <div className="mobileAnalyticsOverdueTitle">{t.title || t.category?.name || 'Без описания'}</div>
                      <div className="mobileAnalyticsOverdueSub">
                        {(t.location?.name || t.pointName || 'Без точки')}
                        <span className="mobileAnalyticsOverdueSla"> · SLA просрочен</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mobileMeta">Просроченных заявок нет.</div>
              )}
            </div>
          ) : null}

          {/* Подрядчики — заглушка (нет данных в API; детально C2.5) */}
          {analyticsView === 'contractors' ? (
            <div className="mobileCard">
              <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Подрядчики</div>
              <div className="mobileAnalyticsFilterStub">Аналитика по подрядчикам — после доработки API.</div>
            </div>
          ) : null}

          {/* Оборудование — заглушка (счётчики/health детально C2.5) */}
          {analyticsView === 'equipment' ? (
            <div className="mobileCard">
              <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Оборудование</div>
              <div className="mobileAnalyticsFilterStub">Счётчики заявок по оборудованию и статус ТО — в следующем шаге.</div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {/* Техник: контекст по точкам + распределение (context) */}
          <div className="mobileCard">
            <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Точки с наибольшим числом активных заявок</div>
            {contextQ.isSuccess && topLocations.length > 0 ? (
              <div className="mobileAnalyticsBarRows">
                {topLocations.map(([name, count]) => (
                  <div key={name} className="mobileAnalyticsBarRow">
                    <span className="mobileAnalyticsBarName">{name}</span>
                    <span className="mobileAnalyticsBarCount">{count}</span>
                    <div className="mobileAnalyticsBarTrack">
                      <div className="mobileAnalyticsBarFill mobileAnalyticsBarFill--location" style={{ width: `${pct(count, maxLoc)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mobileMeta">{contextQ.isLoading ? 'Загрузка…' : 'Нет данных'}</div>
            )}
          </div>

          <div className="mobileCard">
            <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Распределение по статусам</div>
            <div className="mobileAnalyticsBarRows">
              {statusRows.map(({ label, value, mod }) => (
                <div key={mod} className="mobileAnalyticsBarRow">
                  <span className="mobileAnalyticsBarName">{label}</span>
                  <span className="mobileAnalyticsBarCount">{fmt(value)}</span>
                  <div className="mobileAnalyticsBarTrack">
                    <div className={`mobileAnalyticsBarFill mobileAnalyticsBarFill--${mod}`} style={{ width: `${value == null ? 0 : pct(value, statusMax)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mobileMeta" style={{ textAlign: 'center', opacity: 0.7 }}>
        <Link to={homeHref} className="mobileAnalyticsHomeLink" style={{ color: 'inherit' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          На главную
        </Link>
      </div>

      {/* Bottom-sheet «Параметры» (модалка 42) — клиентские фильтры */}
      {filterOpen ? (
        <div className="mobileSheetBackdrop" onClick={() => setFilterOpen(false)}>
          <div className="mobileSheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobileSheetGrip" />
            <div className="mobileSheetHeader">
              <div className="mobileSheetTitle">Параметры</div>
              <button type="button" className="mobileSheetClose" onClick={() => setFilterOpen(false)} aria-label="Закрыть">
                {IconClose}
              </button>
            </div>

            <div className="mobileAnalyticsFilterBody">
              {/* Период (синхронизирован с чипами на экране) */}
              <section>
                <div className="mobileAnalyticsFilterLabel">Период</div>
                <div className="mobileAnalyticsPeriodRow">
                  {PERIOD_CHIPS.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`mobileAnalyticsPeriodChip${period === key ? ' mobileAnalyticsPeriodChip--active' : ''}`}
                      onClick={() => setPeriod(key)}
                    >
                      {key === 'custom' ? 'Произвольный' : label}
                    </button>
                  ))}
                </div>
                {period === 'custom' ? (
                  <div className="mobileAnalyticsCustomRow" style={{ marginTop: 8 }}>
                    <input type="date" className="mobileAnalyticsDateInput" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} aria-label="Дата с" />
                    <input type="date" className="mobileAnalyticsDateInput" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} aria-label="Дата по" />
                  </div>
                ) : null}
              </section>

              {/* Объекты */}
              <section>
                <div className="mobileAnalyticsFilterLabel">
                  Объекты {selObjects.size > 0 ? `(${selObjects.size})` : '(все)'}
                </div>
                {objectOptions.length > 0 ? (
                  <div className="mobileAnalyticsFilterChips">
                    {objectOptions.map(([id, name]) => (
                      <button
                        key={id}
                        type="button"
                        className={`mobileAnalyticsFilterChip${selObjects.has(id) ? ' mobileAnalyticsFilterChip--active' : ''}`}
                        onClick={() => setSelObjects((p) => toggleInSet(p, id))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mobileMeta">Нет данных по объектам.</div>
                )}
              </section>

              {/* Категории */}
              <section>
                <div className="mobileAnalyticsFilterLabel">
                  Категории {selCats.size > 0 ? `(${selCats.size})` : '(все)'}
                </div>
                {categoryOptions.length > 0 ? (
                  <div className="mobileAnalyticsFilterChips">
                    {categoryOptions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={`mobileAnalyticsFilterChip${selCats.has(name) ? ' mobileAnalyticsFilterChip--active' : ''}`}
                        onClick={() => setSelCats((p) => toggleInSet(p, name))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mobileMeta">Нет данных по категориям.</div>
                )}
              </section>

              {/* Статусы */}
              <section>
                <div className="mobileAnalyticsFilterLabel">
                  Статусы {selStatuses.size > 0 ? `(${selStatuses.size})` : '(все)'}
                </div>
                <div className="mobileAnalyticsFilterChips">
                  {STATUS_FILTER.map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      className={`mobileAnalyticsFilterChip${selStatuses.has(code) ? ' mobileAnalyticsFilterChip--active' : ''}`}
                      onClick={() => setSelStatuses((p) => toggleInSet(p, code))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Подрядчики — заглушка (нет данных в API) */}
              <section>
                <div className="mobileAnalyticsFilterLabel">Подрядчики</div>
                <div className="mobileAnalyticsFilterStub">
                  Аналитика по подрядчикам — после доработки API.
                </div>
              </section>

              <div className="mobileAnalyticsFilterActions">
                <button type="button" className="mobileBtn mobileBtnSecondary" style={{ flex: 1 }} onClick={resetFilters}>
                  Сбросить
                </button>
                <button type="button" className="mobileBtn" style={{ flex: 1 }} onClick={() => setFilterOpen(false)}>
                  Применить
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
