import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import {
  ALL_CITIES_KEY,
  NO_CITY_KEY,
  groupLocationsByCity,
  retainSelectableLocations,
  selectVisibleLocations,
  toggleLocationSelection,
} from '../lib/locationAnalyticsGrouping'
import {
  analyticsPeriodRange,
  buildStatusRows,
  canUseManagementAnalytics,
  citySlaRows,
  describePeriod,
  formatCount,
  selectScopeMetrics,
  type AnalyticsPeriod,
} from '../lib/mobileAnalyticsMetrics'
import { describeOpenOverdue, describeSlaBasis, formatMinutes, formatOpenOverdue, formatSlaRatio } from '../lib/slaFormat'
import { mobilePath } from './mobileRoute'
import { MobileSectionBackLink } from './MobileSectionBackLink'
import { mobileTicketNumberTitle, mobileTicketStatusLabelRu } from './mobileTicketDisplay'

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

function toggleInSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

type AnalyticsView = 'overview' | 'city-sla' | 'top-objects' | 'top-cats' | 'overdue' | 'contractors' | 'equipment'

const ANALYTICS_VIEWS: Array<[AnalyticsView, string]> = [
  ['overview', 'Обзор'],
  ['city-sla', 'SLA по городам'],
  ['top-objects', 'ТОП объектов'],
  ['top-cats', 'ТОП категорий'],
  ['overdue', 'Просрочки'],
  ['contractors', 'Подрядчики'],
  ['equipment', 'Оборудование'],
]

/** 403 — показать понятную причину, а не сырой текст ответа. */
function queryErrorText(error: unknown): string {
  if (error instanceof api.ApiRequestError && error.status === 403) return 'Нет доступа к управленческой аналитике для вашей роли.'
  return error instanceof Error ? error.message : ''
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
const IconUsers = (
  <TablerIcon>
    <path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
    <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />
  </TablerIcon>
)

export function MobileAnalytics() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  // Роль из @Roles И серверный флаг ManagementSurface — иначе экран упирается в 403.
  const isAnalyticsAdmin = canUseManagementAnalytics(meQ.data)

  // Период — локальные сутки пользователя; уходит в /analytics/locations ISO-моментами.
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const range = useMemo(() => analyticsPeriodRange(period, customFrom, customTo), [period, customFrom, customTo])
  const periodLabel = describePeriod(period, range)

  /*
   * «Город → Точки» — представление уже разрешённых строк, как на десктопе
   * (LocationAnalyticsPage): ни город, ни точки в запрос не уходят, область
   * доступа не меняется. Категория уходит в запрос (categoryId) — тогда итоги,
   * города и SLA считает бэкенд, а не клиент.
   */
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedCityKey, setSelectedCityKey] = useState(ALL_CITIES_KEY)
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [selStatuses, setSelStatuses] = useState<Set<api.TicketStatus>>(new Set())

  const resetFilters = () => {
    setSelectedCityKey(ALL_CITIES_KEY)
    setSelectedLocationIds([])
    setCategoryId('')
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

  // ── Overview — только динамика публичных заявок (периода не поддерживает) ──
  const overviewQ = useQuery({
    queryKey: ['mobile-analytics-overview', linkedClientCompanyId, companyId],
    queryFn: () => api.analyticsOverview(scopeParams),
    enabled: !!meQ.data && isAnalyticsAdmin,
  })

  /*
   * Locations за период — источник всех цифр управленческого экрана.
   * includeEmptyLocations: точки без заявок нужны в выборе города и точек,
   * а в цифрах дают честный ноль.
   */
  const baseLocationsParams = { ...scopeParams, from: range.from, to: range.to, includeEmptyLocations: true }
  const baseLocationsQ = useQuery({
    queryKey: ['mobile-analytics-locations', linkedClientCompanyId, companyId, range.from, range.to, ''],
    queryFn: () => api.analyticsLocations(baseLocationsParams),
    enabled: !!meQ.data && isAnalyticsAdmin,
  })
  // С выбранной категорией — отдельный запрос; без неё ключ тот же и запрос один.
  const locationsQ = useQuery({
    queryKey: ['mobile-analytics-locations', linkedClientCompanyId, companyId, range.from, range.to, categoryId],
    queryFn: () => api.analyticsLocations({ ...baseLocationsParams, categoryId: categoryId || undefined }),
    enabled: !!meQ.data && isAnalyticsAdmin,
  })

  // ── Context (все роли) — счётчики заявок по локациям и оборудованию ──
  const contextQ = useQuery({
    queryKey: ['mobile-analytics-context', linkedClientCompanyId, companyId],
    queryFn: () => api.ticketContextAnalytics(scopeParams),
    enabled: !!meQ.data,
  })

  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>('overview')
  const boardQ = useQuery({
    queryKey: ['mobile-analytics-overdue-board', linkedClientCompanyId, companyId],
    queryFn: () => api.board({ ...scopeParams, take: 500 }),
    enabled: !!meQ.data && isAnalyticsAdmin && analyticsView === 'overdue',
  })

  // Состав городов, точек и категорий — из ответа без категории: выбор категории их не прячет.
  const baseItems = useMemo(() => baseLocationsQ.data?.items ?? [], [baseLocationsQ.data])
  const cityGroups = useMemo(() => groupLocationsByCity(baseItems), [baseItems])
  const activeCityGroup = cityGroups.find((group) => group.cityKey === selectedCityKey) ?? null
  const effectiveCityKey = activeCityGroup ? selectedCityKey : ALL_CITIES_KEY
  const effectiveLocationIds = useMemo(
    () => retainSelectableLocations(baseItems, effectiveCityKey, selectedLocationIds),
    [baseItems, effectiveCityKey, selectedLocationIds],
  )

  const categoryOptions = useMemo<Array<[string, string]>>(() => {
    const byId = new Map<string, string>()
    for (const loc of baseItems) for (const c of loc.categories) byId.set(c.categoryId, c.categoryName)
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'))
  }, [baseItems])
  const activeCategoryName = categoryOptions.find(([id]) => id === categoryId)?.[1] ?? null

  const activeFilterCount =
    (effectiveCityKey !== ALL_CITIES_KEY ? 1 : 0) + effectiveLocationIds.length + (categoryId ? 1 : 0) + selStatuses.size

  function selectCity(cityKey: string) {
    setSelectedCityKey(cityKey)
    setSelectedLocationIds([]) // точки другого города в выборе не остаются
  }

  // Строки выбранной области (порядок бэкенда — по убыванию заявок).
  const visibleItems = useMemo(
    () => selectVisibleLocations(locationsQ.data?.items ?? [], effectiveCityKey, effectiveLocationIds),
    [locationsQ.data, effectiveCityKey, effectiveLocationIds],
  )
  const visibleLocationIds = useMemo(() => new Set(visibleItems.map((i) => i.locationId)), [visibleItems])

  // KPI: организация — summary, город — cityGroups бэкенда, точки — их строки.
  const scopeMetrics = useMemo(
    () => selectScopeMetrics(locationsQ.data, effectiveCityKey, effectiveLocationIds),
    [locationsQ.data, effectiveCityKey, effectiveLocationIds],
  )
  const scopeSla = scopeMetrics?.sla ?? null
  const scopeLabel = !scopeMetrics
    ? ''
    : scopeMetrics.scope === 'locations'
      ? `${scopeMetrics.locationsCount} ${scopeMetrics.locationsCount === 1 ? 'точка' : scopeMetrics.locationsCount < 5 ? 'точки' : 'точек'}`
      : scopeMetrics.scope === 'city'
        ? activeCityGroup?.cityLabel ?? ''
        : 'вся организация'

  const contextKpi = useMemo(() => {
    const ctx = contextQ.data
    if (!ctx) return { active: null, done: null, total: null }
    let active = 0
    let done = 0
    for (const l of ctx.byLocation) {
      active += l.NEW + l.IN_PROGRESS
      done += l.DONE
    }
    return { active, done, total: ctx.meta.totalTickets }
  }, [contextQ.data])

  const topCategories = useMemo<Array<[string, number]>>(() => {
    const map = new Map<string, number>()
    for (const loc of visibleItems) {
      for (const c of loc.categories) map.set(c.categoryName, (map.get(c.categoryName) || 0) + c.ticketsCount)
    }
    return [...map.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [visibleItems])

  const topLocations = useMemo<Array<[string, number]>>(() => {
    const byLoc = contextQ.data?.byLocation
    if (!byLoc) return []
    return byLoc
      .map((l) => [l.locationName, l.NEW + l.IN_PROGRESS] as [string, number])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [contextQ.data])

  const topObjects = useMemo(
    () =>
      visibleItems
        .map((l) => ({ id: l.locationId, name: l.locationName, city: l.city, total: l.totalTickets, overdue: l.overdueTickets }))
        .filter((o) => o.total > 0),
    [visibleItems],
  )

  // Просрочки: текущие карточки доски (без периода), с учётом города/точек, категории и статусов.
  const overdueTickets = useMemo(() => {
    const cols = boardQ.data?.columns ?? []
    const narrowLocations = effectiveCityKey !== ALL_CITIES_KEY || effectiveLocationIds.length > 0
    const out: api.TicketCard[] = []
    for (const col of cols) {
      for (const c of col.cards) {
        if (!c.slaBreached) continue
        if (narrowLocations && !(c.location?.id && visibleLocationIds.has(c.location.id))) continue
        if (activeCategoryName && c.category?.name !== activeCategoryName) continue
        if (selStatuses.size && !selStatuses.has(c.status)) continue
        out.push(c)
      }
    }
    return out
  }, [boardQ.data, effectiveCityKey, effectiveLocationIds, visibleLocationIds, activeCategoryName, selStatuses])

  const dynamicsByDay = useMemo(() => (overviewQ.data?.publicIntake?.byDay ?? []).slice(-14), [overviewQ.data])
  const dynamicsMax = Math.max(1, ...dynamicsByDay.map((d) => d.total))

  const equipmentRows = useMemo(() => {
    const eq = contextQ.data?.byEquipment ?? []
    return [...eq].sort((a, b) => b.total - a.total)
  }, [contextQ.data])

  // Распределение: у управленца — за период по выбранной области; у прочих — context.
  const adminStatusRows = useMemo(() => buildStatusRows(scopeMetrics, selStatuses), [scopeMetrics, selStatuses])
  const contextStatusRows = useMemo(() => {
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
      { key: 'new', label: 'Новые', value: ctx ? n : null },
      { key: 'inprogress', label: 'В работе', value: ctx ? ip : null },
      { key: 'done', label: 'Выполненные', value: ctx ? d : null },
    ]
  }, [contextQ.data])

  const cityRows = useMemo(() => citySlaRows(locationsQ.data?.cityGroups), [locationsQ.data])
  const hasServerCities = Array.isArray(locationsQ.data?.cityGroups)

  const scope = scopeParams
  const homeHref = api.appendScopeToPath(mobilePath(location.pathname, ''), scope, meQ.data)

  const maxCat = topCategories[0]?.[1] || 1
  const maxLoc = topLocations[0]?.[1] || 1
  const adminStatusMax = Math.max(1, ...adminStatusRows.map((r) => r.value ?? 0))
  const contextStatusMax = Math.max(1, ...contextStatusRows.map((r) => r.value ?? 0))
  const pct = (n: number, max: number) => Math.round((n / max) * 100)

  // Пока данных нет: загрузка — «…», ошибка — прочерк, но не ноль.
  const kpiLoading = isAnalyticsAdmin ? locationsQ.isLoading : contextQ.isLoading
  const kpiValue = (value: number | null | undefined) => (kpiLoading ? '…' : formatCount(value))

  const subtitle = isAnalyticsAdmin
    ? activeFilterCount > 0
      ? `${periodLabel} · ${activeFilterCount} фильтр${activeFilterCount === 1 ? '' : activeFilterCount < 5 ? 'а' : 'ов'}`
      : periodLabel
    : 'Сводка по текущему контуру заявок'

  const periodChips = (inSheet: boolean) => (
    <div className="mobileAnalyticsPeriodRow">
      {PERIOD_CHIPS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`mobileAnalyticsPeriodChip${period === key ? ' mobileAnalyticsPeriodChip--active' : ''}`}
          onClick={() => setPeriod(key)}
          aria-pressed={period === key}
        >
          {inSheet && key === 'custom' ? 'Произвольный' : label}
        </button>
      ))}
    </div>
  )

  const customRange = (style?: CSSProperties) =>
    period === 'custom' ? (
      <div className="mobileAnalyticsCustomRow" style={style}>
        <input type="date" className="mobileAnalyticsDateInput" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} aria-label="Дата с" />
        <input type="date" className="mobileAnalyticsDateInput" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} aria-label="Дата по" />
      </div>
    ) : null

  const cityPicker = (
    <div className="mobileAnalyticsFilterChips">
      <button
        type="button"
        className={`mobileAnalyticsFilterChip${effectiveCityKey === ALL_CITIES_KEY ? ' mobileAnalyticsFilterChip--active' : ''}`}
        onClick={() => selectCity(ALL_CITIES_KEY)}
        aria-pressed={effectiveCityKey === ALL_CITIES_KEY}
      >
        Все города
      </button>
      {cityGroups.map((group) => (
        <button
          key={group.cityKey}
          type="button"
          className={`mobileAnalyticsFilterChip${effectiveCityKey === group.cityKey ? ' mobileAnalyticsFilterChip--active' : ''}`}
          onClick={() => selectCity(group.cityKey)}
          aria-pressed={effectiveCityKey === group.cityKey}
          style={group.cityKey === NO_CITY_KEY ? { fontStyle: 'italic' } : undefined}
        >
          {group.cityLabel} · {group.locationsCount}
        </button>
      ))}
    </div>
  )

  const pointPicker = activeCityGroup ? (
    <div className="mobileAnalyticsFilterChips">
      <button
        type="button"
        className={`mobileAnalyticsFilterChip${effectiveLocationIds.length === 0 ? ' mobileAnalyticsFilterChip--active' : ''}`}
        onClick={() => setSelectedLocationIds([])}
        aria-pressed={effectiveLocationIds.length === 0}
      >
        Все точки
      </button>
      {activeCityGroup.locations.map((loc) => (
        <button
          key={loc.locationId}
          type="button"
          className={`mobileAnalyticsFilterChip${effectiveLocationIds.includes(loc.locationId) ? ' mobileAnalyticsFilterChip--active' : ''}`}
          onClick={() => setSelectedLocationIds((prev) => toggleLocationSelection(prev, loc.locationId))}
          aria-pressed={effectiveLocationIds.includes(loc.locationId)}
        >
          {loc.locationName}
        </button>
      ))}
    </div>
  ) : null

  return (
    <div className="mobileSection">
      <MobileSectionBackLink />
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

      {isAnalyticsAdmin ? (
        <>
          {periodChips(false)}
          {customRange()}
          {/* Город и точки — на экране, а не только в «Параметрах»: это главный разрез. */}
          {cityGroups.length > 0 ? (
            <div className="mobileAnalyticsScopePicker">
              {cityPicker}
              {pointPicker}
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
              <div className="mobileAnalyticsValue">{kpiValue(scopeMetrics?.totalTickets)}</div>
              <div className="mobileAnalyticsLabel">Заявок за период</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--overdue">
              <div className="mobileAnalyticsCardIcon">{KpiIconOverdue}</div>
              <div className="mobileAnalyticsValue">{kpiValue(scopeMetrics?.overdueTickets)}</div>
              <div className="mobileAnalyticsLabel">Просрочено</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--done">
              <div className="mobileAnalyticsCardIcon">{KpiIconDone}</div>
              <div className="mobileAnalyticsValue">{kpiValue(scopeMetrics?.doneTickets)}</div>
              <div className="mobileAnalyticsLabel">Выполнено</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--sla">
              <div className="mobileAnalyticsCardIcon">{KpiIconSla}</div>
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : formatSlaRatio(scopeSla?.withinSlaRatio)}</div>
              <div className="mobileAnalyticsLabel">SLA соблюдён</div>
            </div>
          </>
        ) : (
          <>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--active">
              <div className="mobileAnalyticsCardIcon">{KpiIconActive}</div>
              <div className="mobileAnalyticsValue">{kpiValue(contextKpi.active)}</div>
              <div className="mobileAnalyticsLabel">Активные заявки</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--done">
              <div className="mobileAnalyticsCardIcon">{KpiIconDone}</div>
              <div className="mobileAnalyticsValue">{kpiValue(contextKpi.done)}</div>
              <div className="mobileAnalyticsLabel">Выполнено</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--total">
              <div className="mobileAnalyticsCardIcon">{KpiIconTickets}</div>
              <div className="mobileAnalyticsValue">{kpiValue(contextKpi.total)}</div>
              <div className="mobileAnalyticsLabel">Всего заявок</div>
            </div>
          </>
        )}
      </div>

      {isAnalyticsAdmin && scopeMetrics ? (
        <div className="mobileAnalyticsSlaNote">
          {scopeLabel}
          {activeCategoryName ? ` · ${activeCategoryName}` : ''}
          {' · SLA: '}
          {scopeSla ? describeSlaBasis(scopeSla) : 'нет данных'}
        </div>
      ) : null}

      {isAnalyticsAdmin && overviewQ.isError ? (
        <div className="mobileNotice mobileNoticeError">Не удалось загрузить обзор. {queryErrorText(overviewQ.error)}</div>
      ) : null}
      {isAnalyticsAdmin && locationsQ.isError ? (
        <div className="mobileNotice mobileNoticeError">Не удалось загрузить данные по точкам. {queryErrorText(locationsQ.error)}</div>
      ) : null}
      {!isAnalyticsAdmin && contextQ.isError ? (
        <div className="mobileNotice mobileNoticeError">Не удалось загрузить аналитику. {queryErrorText(contextQ.error)}</div>
      ) : null}

      {!isAnalyticsAdmin && meQ.data ? (
        <div className="mobileCard">
          <div className="mobileMeta">Обзор (SLA, сроки, нагрузка) доступен управленческим ролям.</div>
        </div>
      ) : null}

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

          {analyticsView === 'overview' ? (
            <>
              <div className="mobileCard">
                <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>SLA · {scopeLabel || '—'}</div>
                {locationsQ.isLoading ? (
                  <div className="mobileMeta">Загрузка…</div>
                ) : scopeSla ? (
                  <>
                    <div className="mobileAnalyticsTiming">
                      <div>
                        <div className="mobileAnalyticsTimingVal">{formatMinutes(scopeSla.avgResponseMinutes)}</div>
                        <div className="mobileAnalyticsTimingLabel">Ср. время реакции · по {formatCount(scopeSla.respondedCount)}</div>
                      </div>
                      <div>
                        <div className="mobileAnalyticsTimingVal">{formatMinutes(scopeSla.avgResolutionMinutes)}</div>
                        <div className="mobileAnalyticsTimingLabel">Ср. время решения · по {formatCount(scopeSla.resolvedCount)}</div>
                      </div>
                      <div>
                        <div className="mobileAnalyticsTimingVal">{formatOpenOverdue(scopeSla)}</div>
                        <div className="mobileAnalyticsTimingLabel">Просрочено сейчас · {describeOpenOverdue(scopeSla)}</div>
                      </div>
                      <div>
                        <div className="mobileAnalyticsTimingVal">{formatCount(scopeSla.slaBreaches)}</div>
                        <div className="mobileAnalyticsTimingLabel">Нарушения SLA за период</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mobileMeta">Нет данных SLA для выбранной области.</div>
                )}
              </div>

              <div className="mobileCard">
                <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Распределение по статусам</div>
                {locationsQ.isLoading ? (
                  <div className="mobileMeta">Загрузка…</div>
                ) : adminStatusRows.length > 0 ? (
                  <div className="mobileAnalyticsBarRows">
                    {adminStatusRows.map(({ key, label, value }) => (
                      <div key={key} className="mobileAnalyticsBarRow">
                        <span className="mobileAnalyticsBarName">{label}</span>
                        <span className="mobileAnalyticsBarCount">{formatCount(value)}</span>
                        <div className="mobileAnalyticsBarTrack">
                          <div className={`mobileAnalyticsBarFill mobileAnalyticsBarFill--${key}`} style={{ width: `${value == null ? 0 : pct(value, adminStatusMax)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mobileMeta">Нет строк для выбранных статусов.</div>
                )}
                {scopeMetrics && scopeMetrics.ticketsOutsideRows > 0 ? (
                  <div className="mobileMeta" style={{ marginTop: 8 }}>
                    Ещё {formatCount(scopeMetrics.ticketsOutsideRows)} заявок — на деактивированных точках: в итоге учтены, в разбивке нет.
                  </div>
                ) : null}
              </div>

              <div className="mobileCard">
                <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Динамика</div>
                {overviewQ.isLoading ? (
                  <div className="mobileMeta">Загрузка…</div>
                ) : overviewQ.isError ? (
                  <div className="mobileMeta">Нет данных.</div>
                ) : dynamicsByDay.length > 0 ? (
                  <>
                    <div className="mobileMeta" style={{ marginBottom: 8 }}>Публичные заявки по дням (14 дней, без учёта фильтров)</div>
                    <div className="mobileAnalyticsChart">
                      {dynamicsByDay.map((d, i) => (
                        <div
                          key={d.day}
                          className={`mobileAnalyticsChartBar${i === dynamicsByDay.length - 1 ? ' mobileAnalyticsChartBar--last' : ''}`}
                          style={{ height: `${Math.max(6, Math.round((d.total / dynamicsMax) * 100))}%` }}
                          title={`${d.day}: ${d.total}`}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mobileMeta">Публичных заявок нет.</div>
                )}
              </div>
            </>
          ) : null}

          {/* SLA по городам — агрегаты бэкенда (cityGroups), без пересчёта на клиенте */}
          {analyticsView === 'city-sla' ? (
            <div className="mobileCard">
              <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>SLA по городам</div>
              {locationsQ.isLoading ? (
                <div className="mobileMeta">Загрузка…</div>
              ) : !hasServerCities ? (
                <div className="mobileMeta">Нет данных: сервер не отдаёт агрегаты по городам.</div>
              ) : cityRows.length > 0 ? (
                <div className="mobileAnalyticsOverdueList">
                  {cityRows.map((city) => (
                    <button
                      key={city.cityKey}
                      type="button"
                      className={`mobileAnalyticsOverdueRow mobileAnalyticsCityRow${effectiveCityKey === city.cityKey ? ' mobileAnalyticsCityRow--active' : ''}`}
                      onClick={() => selectCity(effectiveCityKey === city.cityKey ? ALL_CITIES_KEY : city.cityKey)}
                      aria-pressed={effectiveCityKey === city.cityKey}
                    >
                      <div className="mobileAnalyticsOverdueTop">
                        <span className="mobileAnalyticsEquipName" style={city.cityKey === NO_CITY_KEY ? { fontStyle: 'italic' } : undefined}>
                          {city.cityLabel}
                        </span>
                        <span className="mobileAnalyticsBarCount">{formatSlaRatio(city.sla?.withinSlaRatio)}</span>
                      </div>
                      <div className="mobileAnalyticsOverdueSub">
                        {formatCount(city.locationsCount)} точ. · {formatCount(city.totalTickets)} заявок · {city.sla ? describeSlaBasis(city.sla) : 'нет данных SLA'}
                      </div>
                      <div className="mobileAnalyticsOverdueSub">
                        Реакция {formatMinutes(city.sla?.avgResponseMinutes)} · Решение {formatMinutes(city.sla?.avgResolutionMinutes)} · Просрочено сейчас{' '}
                        {city.sla ? formatOpenOverdue(city.sla) : '—'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mobileMeta">Нет заявок за период.</div>
              )}
            </div>
          ) : null}

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
                <div className="mobileMeta">{locationsQ.isLoading ? 'Загрузка…' : locationsQ.isError ? 'Нет данных' : 'Нет заявок за период.'}</div>
              )}
            </div>
          ) : null}

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
                <div className="mobileMeta">{locationsQ.isLoading ? 'Загрузка…' : locationsQ.isError ? 'Нет данных' : 'Нет заявок за период.'}</div>
              )}
            </div>
          ) : null}

          {analyticsView === 'overdue' ? (
            <div className="mobileCard">
              <div className="mobileSectionTitle" style={{ marginBottom: 4 }}>Просрочки</div>
              <div className="mobileMeta" style={{ marginBottom: 10 }}>Текущие заявки с нарушенным SLA, без учёта периода.</div>
              {boardQ.isLoading ? (
                <div className="mobileMeta">Загрузка…</div>
              ) : boardQ.isError ? (
                <div className="mobileMeta">Не удалось загрузить список просрочек. {queryErrorText(boardQ.error)}</div>
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
                        {t.location?.name || t.pointName || 'Без точки'}
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

          {analyticsView === 'contractors' ? (
            <div className="mobileCard">
              <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Подрядчики</div>
              <div className="mobileAnalyticsStubCard">
                <span className="mobileAnalyticsStubIcon">{IconUsers}</span>
                <div className="mobileMeta" style={{ textAlign: 'center' }}>
                  Аналитика по подрядчикам появится после доработки API.
                </div>
              </div>
            </div>
          ) : null}

          {analyticsView === 'equipment' ? (
            <div className="mobileCard">
              <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Оборудование</div>
              {contextQ.isLoading ? (
                <div className="mobileMeta">Загрузка…</div>
              ) : contextQ.isError ? (
                <div className="mobileMeta">Не удалось загрузить данные по оборудованию.</div>
              ) : equipmentRows.length > 0 ? (
                <div className="mobileAnalyticsOverdueList">
                  {equipmentRows.map((eq) => (
                    <div key={eq.equipmentId} className="mobileAnalyticsOverdueRow">
                      <div className="mobileAnalyticsOverdueTop">
                        <span className="mobileAnalyticsEquipName">{eq.equipmentName}</span>
                        <span className="mobileAnalyticsBarCount">{eq.total} заявок</span>
                      </div>
                      <div className="mobileAnalyticsOverdueSub">
                        {eq.locationName || 'Без точки'} · В работе {eq.NEW + eq.IN_PROGRESS} · Выполнено {eq.DONE}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mobileMeta">Нет данных по оборудованию.</div>
              )}
              <div className="mobileAnalyticsFilterStub" style={{ marginTop: 10 }}>
                Счётчики — за всё время, без учёта периода и фильтров. Статус ТО — после Equipment-модуля.
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
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
              <div className="mobileMeta">{contextQ.isLoading ? 'Загрузка…' : contextQ.isError ? 'Нет данных' : 'Активных заявок нет.'}</div>
            )}
          </div>

          <div className="mobileCard">
            <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Распределение по статусам</div>
            <div className="mobileAnalyticsBarRows">
              {contextStatusRows.map(({ key, label, value }) => (
                <div key={key} className="mobileAnalyticsBarRow">
                  <span className="mobileAnalyticsBarName">{label}</span>
                  <span className="mobileAnalyticsBarCount">{formatCount(value)}</span>
                  <div className="mobileAnalyticsBarTrack">
                    <div className={`mobileAnalyticsBarFill mobileAnalyticsBarFill--${key}`} style={{ width: `${value == null ? 0 : pct(value, contextStatusMax)}%` }} />
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
              <section>
                <div className="mobileAnalyticsFilterLabel">Период</div>
                {periodChips(true)}
                {customRange({ marginTop: 8 })}
              </section>

              <section>
                <div className="mobileAnalyticsFilterLabel">Город</div>
                {cityGroups.length > 0 ? cityPicker : <div className="mobileMeta">Нет данных по точкам.</div>}
              </section>

              {activeCityGroup ? (
                <section>
                  <div className="mobileAnalyticsFilterLabel">
                    Точки города {effectiveLocationIds.length > 0 ? `(${effectiveLocationIds.length} из ${activeCityGroup.locationsCount})` : '(все)'}
                  </div>
                  {pointPicker}
                </section>
              ) : null}

              <section>
                <div className="mobileAnalyticsFilterLabel">Категория {activeCategoryName ? '' : '(все)'}</div>
                {categoryOptions.length > 0 ? (
                  <div className="mobileAnalyticsFilterChips">
                    {categoryOptions.map(([id, name]) => (
                      <button
                        key={id}
                        type="button"
                        className={`mobileAnalyticsFilterChip${categoryId === id ? ' mobileAnalyticsFilterChip--active' : ''}`}
                        onClick={() => setCategoryId((prev) => (prev === id ? '' : id))}
                        aria-pressed={categoryId === id}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mobileMeta">Нет заявок с категориями за период.</div>
                )}
              </section>

              <section>
                <div className="mobileAnalyticsFilterLabel">Статусы {selStatuses.size > 0 ? `(${selStatuses.size})` : '(все)'}</div>
                <div className="mobileAnalyticsFilterChips">
                  {STATUS_FILTER.map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      className={`mobileAnalyticsFilterChip${selStatuses.has(code) ? ' mobileAnalyticsFilterChip--active' : ''}`}
                      onClick={() => setSelStatuses((p) => toggleInSet(p, code))}
                      aria-pressed={selStatuses.has(code)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="mobileAnalyticsFilterLabel">Подрядчики</div>
                <div className="mobileAnalyticsFilterStub">Аналитика по подрядчикам — после доработки API.</div>
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
