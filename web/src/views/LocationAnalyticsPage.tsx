import { Link, useSearchParams } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

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
  const [locationId, setLocationId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [minTickets, setMinTickets] = useState('')
  const [expandedLocationId, setExpandedLocationId] = useState<string | null>(null)

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
      </div>

      {q.isError ? <div className="alert">{(q.error as any)?.message || String(q.error)}</div> : null}

      {/* Location list */}
      {!q.isLoading && items.length === 0 ? (
        <div className="panel">
          <div className="muted small">Нет данных по заявкам для выбранных фильтров.</div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((loc) => {
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
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{loc.locationName}</div>
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
