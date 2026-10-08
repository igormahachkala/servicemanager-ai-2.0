import { Link, useSearchParams } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import { readLocationFilterFromSearch, readOutboundScopeFromSearch } from '../lib/locationCardSections'
import { locationCardPath } from '../lib/equipmentCard'
import {
  ALL_CITIES_KEY,
  NO_CITY_KEY,
  groupLocationsByCity,
  retainSelectableLocations,
  selectVisibleLocations,
  toggleLocationSelection,
} from '../lib/locationAnalyticsGrouping'

function fmtNumber(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('ru-RU').format(v)
}

function buildBackLink(params: { companyId?: string; linkedClientCompanyId?: string }) {
  const sp = new URLSearchParams()
  if (params.companyId) sp.set('companyId', params.companyId)
  if (params.linkedClientCompanyId) sp.set('linkedClientCompanyId', params.linkedClientCompanyId)
  const qs = sp.toString()
  return `/analytics${qs ? `?${qs}` : ''}`
}

export function LocationAnalyticsPage() {
  const [searchParams] = useSearchParams()

  const scopeCompanyId = searchParams.get('companyId')?.trim() || ''
  const scopeLinkedClientCompanyId = searchParams.get('linkedClientCompanyId')?.trim() || ''

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  /* SMA-LOCATION-CARD-V2: точка приходит из адреса — иначе переход с карточки не сужает. */
  const [locationId, setLocationId] = useState(() => readLocationFilterFromSearch(searchParams))
  const [categoryId, setCategoryId] = useState('')
  const [minTickets, setMinTickets] = useState('')
  const [expandedLocationId, setExpandedLocationId] = useState<string | null>(null)

  /*
   * SMA-ANALYTICS-V2-PHASE1: «Город → Точки».
   *
   * Выбор города и точек — это ПРЕДСТАВЛЕНИЕ уже полученных строк, не
   * параметры запроса: в бэкенд ни город, ни список точек не уезжают, и
   * область доступа не меняется. Группируются только те объекты, которые
   * бэкенд уже разрешил (ANALYTICS_VIEW + Capability + Scope + Relationship,
   * включая сужение SECONDARY по 004C).
   */
  const [selectedCityKey, setSelectedCityKey] = useState(ALL_CITIES_KEY)
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])

  const queryParams = useMemo(() => ({
    companyId: scopeCompanyId || undefined,
    linkedClientCompanyId: scopeLinkedClientCompanyId || undefined,
    from: from || undefined,
    to: to || undefined,
    locationId: locationId || undefined,
    categoryId: categoryId || undefined,
    minTickets: minTickets ? Math.max(1, parseInt(minTickets, 10) || 1) : undefined,
  }), [scopeCompanyId, scopeLinkedClientCompanyId, from, to, locationId, categoryId, minTickets])

  const q = useQuery<api.LocationAnalyticsResponse>({
    queryKey: ['analytics', 'locations', queryParams],
    queryFn: () => api.analyticsLocations(queryParams),
  })

  const data = q.data
  const items = data?.items ?? []
  const summary = data?.summary

  const backLink = buildBackLink({ companyId: scopeCompanyId, linkedClientCompanyId: scopeLinkedClientCompanyId })
  /* Исходящие ссылки возвращают область тем же параметром, которым она пришла. */
  const outboundScope = readOutboundScopeFromSearch(searchParams)

  const cityGroups = useMemo(() => groupLocationsByCity(items), [items])
  const activeCityGroup = useMemo(
    () => cityGroups.find((group) => group.cityKey === selectedCityKey) ?? null,
    [cityGroups, selectedCityKey],
  )

  /*
   * Выбор точек приводится к текущему составу: при смене города и при
   * обновлении данных точки, которых в нём нет, из выбора уходят — иначе
   * «выбрано 3», а показана одна.
   */
  const effectiveSelectedLocationIds = useMemo(
    () => retainSelectableLocations(items, selectedCityKey, selectedLocationIds),
    [items, selectedCityKey, selectedLocationIds],
  )

  /*
   * Отбор идёт по исходным строкам ответа, поэтому порядок бэкенда —
   * по убыванию заявок — сохраняется и при «Все города», и внутри города.
   * Группы нужны только для списка городов.
   */
  const visibleLocations = useMemo(
    () => selectVisibleLocations(items, selectedCityKey, effectiveSelectedLocationIds),
    [items, selectedCityKey, effectiveSelectedLocationIds],
  )

  function selectCity(cityKey: string) {
    setSelectedCityKey(cityKey)
    // Точки другого города в выборе не остаются.
    setSelectedLocationIds([])
    setExpandedLocationId(null)
  }

  function toggleLocation(locId: string) {
    setSelectedLocationIds((prev) => toggleLocationSelection(prev, locId))
  }

  function toggleExpand(locId: string) {
    setExpandedLocationId((prev) => (prev === locId ? null : locId))
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Аналитика по точкам</h2>
          <div className="muted small">
            {q.isFetching
              ? 'Загрузка…'
              : data
                ? `${fmtNumber(summary?.totalLocations)} точек · ${fmtNumber(summary?.totalTickets)} заявок`
                : '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => q.refetch()} disabled={q.isFetching}>Обновить</button>
          <Link to={backLink}><button className="ghost">← Аналитика</button></Link>
        </div>
      </div>

      <div className="pageHint">Распределение заявок по точкам обслуживания с разбивкой по категориям.</div>

      {/* Filters */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Фильтры</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <label>
            <div className="fieldLabel">Период от</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            <div className="fieldLabel">Период до</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            <div className="fieldLabel">ID точки</div>
            <input
              type="text"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="Оставьте пустым — все"
              style={{ width: '100%' }}
            />
          </label>
          <label>
            <div className="fieldLabel">ID категории</div>
            <input
              type="text"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="Оставьте пустым — все"
              style={{ width: '100%' }}
            />
          </label>
          <label>
            <div className="fieldLabel">Мин. заявок</div>
            <input
              type="number"
              min={1}
              value={minTickets}
              onChange={(e) => setMinTickets(e.target.value)}
              placeholder="Без ограничений"
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </div>

      {/* Summary cards */}
      <div className="panel uiCard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <div className="muted small">Всего точек</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{!q.isFetching ? fmtNumber(summary?.totalLocations) : '—'}</div>
        </div>
        <div>
          <div className="muted small">Всего заявок</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{!q.isFetching ? fmtNumber(summary?.totalTickets) : '—'}</div>
        </div>
        <div>
          <div className="muted small">Просрочено</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: (summary?.totalOverdue ?? 0) > 0 ? '#dc2626' : undefined }}>
            {!q.isFetching ? fmtNumber(summary?.totalOverdue) : '—'}
          </div>
        </div>
        <div>
          <div className="muted small">В работе</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{!q.isFetching ? fmtNumber(summary?.inProgressTotal) : '—'}</div>
        </div>
        <div>
          <div className="muted small">Завершено</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{!q.isFetching ? fmtNumber(summary?.doneTotal) : '—'}</div>
        </div>
        {/*
          Подпись видимая, а не в комментарии: при выбранном городе список
          ниже сужается, а показатели остаются по всему доступному объёму —
          без этой строки их читали бы как итоги выбора. Пересчитывать их
          на фронтенде нельзя: канонические итоги считает бэкенд.
        */}
        <div className="muted small" style={{ gridColumn: '1 / -1', marginTop: 2 }}>
          Показатели рассчитаны по всему доступному объёму данных, а не по выбранному городу или точкам.
        </div>
      </div>

      {q.isError ? <div className="alert">{(q.error as any)?.message || String(q.error)}</div> : null}

      {/*
        SMA-ANALYTICS-V2-PHASE1: «Город → Точки».
        Сводка выше остаётся канонической — она по всей доступной области,
        а не по выбранному городу: пересчитывать её здесь нельзя.
      */}
      {!q.isLoading && cityGroups.length > 0 ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0 }}>Города</h3>
            <span className="muted small">
              {activeCityGroup
                ? `${activeCityGroup.cityLabel} · ${fmtNumber(activeCityGroup.locationsCount)} точек`
                : `${fmtNumber(cityGroups.length)} городов · ${fmtNumber(items.length)} точек`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <button
              className={selectedCityKey === ALL_CITIES_KEY ? undefined : 'ghost'}
              onClick={() => selectCity(ALL_CITIES_KEY)}
              aria-pressed={selectedCityKey === ALL_CITIES_KEY}
            >
              Все города
            </button>
            {cityGroups.map((group) => (
              <button
                key={group.cityKey}
                className={selectedCityKey === group.cityKey ? undefined : 'ghost'}
                onClick={() => selectCity(group.cityKey)}
                aria-pressed={selectedCityKey === group.cityKey}
                style={group.cityKey === NO_CITY_KEY ? { fontStyle: 'italic' } : undefined}
              >
                {group.cityLabel} · {fmtNumber(group.locationsCount)}
              </button>
            ))}
          </div>

          {activeCityGroup ? (
            <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Точки города</div>
                <span className="muted small">
                  {effectiveSelectedLocationIds.length > 0
                    ? `выбрано ${fmtNumber(effectiveSelectedLocationIds.length)} из ${fmtNumber(activeCityGroup.locationsCount)}`
                    : 'выбраны все'}
                </span>
                {effectiveSelectedLocationIds.length > 0 ? (
                  <button className="ghost" onClick={() => setSelectedLocationIds([])}>
                    Сбросить точки
                  </button>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {activeCityGroup.locations.map((loc) => {
                  const picked = effectiveSelectedLocationIds.includes(loc.locationId)
                  return (
                    <button
                      key={loc.locationId}
                      className={picked ? undefined : 'ghost'}
                      onClick={() => toggleLocation(loc.locationId)}
                      aria-pressed={picked}
                    >
                      {loc.locationName}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Location list */}
      {!q.isLoading && items.length === 0 ? (
        <div className="panel">
          <div className="muted small">Нет данных по заявкам для выбранных фильтров.</div>
        </div>
      ) : null}

      {/*
        Город либо точки выбраны, а показывать нечего — это другое состояние,
        чем пустой ответ: фильтры тут не виноваты, и предлагать менять их
        неверно.
      */}
      {!q.isLoading && items.length > 0 && visibleLocations.length === 0 ? (
        <div className="panel">
          <div className="muted small">
            В выбранном городе нет точек под текущий выбор.{' '}
            <button className="ghost" onClick={() => selectCity(ALL_CITIES_KEY)}>
              Все города
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {visibleLocations.map((loc) => {
          const overdueRisk = loc.totalTickets > 0 ? loc.overdueTickets / loc.totalTickets : 0
          const isExpanded = expandedLocationId === loc.locationId
          const topCategory = loc.categories[0]

          return (
            <div key={loc.locationId} className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}
                onClick={() => toggleExpand(loc.locationId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleExpand(loc.locationId)}
              >
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  {/*
                    Phase 2: из строки аналитики — обратно в карточку точки.
                    Область уезжает тем параметром, которым пришла.
                  */}
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>
                    <Link to={locationCardPath(loc.locationId, outboundScope)} onClick={(e) => e.stopPropagation()}>
                      {loc.locationName}
                    </Link>
                  </div>
                  {(loc.city || loc.address) ? (
                    <div className="muted small">{[loc.city, loc.address].filter(Boolean).join(', ')}</div>
                  ) : null}
                  {topCategory ? (
                    <div className="muted small" style={{ marginTop: 2 }}>
                      Топ категория: {topCategory.categoryName} ({fmtNumber(topCategory.ticketsCount)})
                    </div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{fmtNumber(loc.totalTickets)}</div>
                    <div className="muted small">всего</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtNumber(loc.inProgressTickets)}</div>
                    <div className="muted small">в работе</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: loc.overdueTickets > 0 ? '#dc2626' : undefined }}>
                      {fmtNumber(loc.overdueTickets)}
                    </div>
                    <div className="muted small">просрочено</div>
                  </div>
                  {overdueRisk >= 0.3 && loc.totalTickets >= 3 ? (
                    <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, border: '1px solid #fecaca' }}>
                      SLA риск
                    </div>
                  ) : null}
                  <div style={{ color: '#6b7280', fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</div>
                </div>
              </div>

              {isExpanded ? (
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 16px', background: '#f9fafb' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Разбивка по категориям</div>
                  {loc.categories.length === 0 ? (
                    <div className="muted small">Нет категорий.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {loc.categories.map((cat) => (
                        <div key={cat.categoryId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{cat.categoryName}</div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                            <span>{fmtNumber(cat.ticketsCount)} заявок</span>
                            {cat.overdueCount > 0 ? (
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>{fmtNumber(cat.overdueCount)} просрочено</span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="kv uiKv" style={{ marginTop: 10 }}>
                    <div className="k">Новые</div>
                    <div className="v">{fmtNumber(loc.newTickets)}</div>
                    <div className="k">В работе</div>
                    <div className="v">{fmtNumber(loc.inProgressTickets)}</div>
                    <div className="k">Завершено</div>
                    <div className="v">{fmtNumber(loc.doneTickets)}</div>
                    <div className="k">Просрочено</div>
                    <div className="v" style={{ color: loc.overdueTickets > 0 ? '#dc2626' : undefined }}>{fmtNumber(loc.overdueTickets)}</div>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
