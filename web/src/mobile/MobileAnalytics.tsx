import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'

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

export function MobileAnalytics() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const role = meQ.data?.role
  const isAnalyticsAdmin = !!role && ANALYTICS_ADMIN_ROLES.has(role)

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

  // ── Locations (ADMIN-only) — per-location + разбивка по категориям + done/overdue ──
  const locationsQ = useQuery({
    queryKey: ['mobile-analytics-locations', linkedClientCompanyId, companyId],
    queryFn: () => api.analyticsLocations(scopeParams),
    enabled: !!meQ.data && isAnalyticsAdmin,
  })

  // ── Context (все роли) — счётчики заявок по локациям и оборудованию ──
  const contextQ = useQuery({
    queryKey: ['mobile-analytics-context', linkedClientCompanyId, companyId],
    queryFn: () => api.ticketContextAnalytics(scopeParams),
    enabled: !!meQ.data,
  })

  // KPI: для админа из overview+locations, для остальных из context.
  const kpi = useMemo(() => {
    if (isAnalyticsAdmin) {
      const ov = overviewQ.data
      const open = ov?.openByStatus
      const active = open ? open.NEW + open.ASSIGNED + open.IN_PROGRESS : null
      return {
        active,
        overdue: ov?.sla?.breachedCount ?? null,
        done: locationsQ.data?.summary?.doneTotal ?? null,
        slaPercent: ov?.sla?.okPercent ?? null,
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
  }, [isAnalyticsAdmin, overviewQ.data, locationsQ.data, contextQ.data])

  // Топ категорий (ADMIN) — агрегат по всем локациям.
  const topCategories = useMemo<Array<[string, number]>>(() => {
    const items = locationsQ.data?.items
    if (!items) return []
    const map = new Map<string, number>()
    for (const loc of items) {
      for (const c of loc.categories) {
        map.set(c.categoryName, (map.get(c.categoryName) || 0) + c.ticketsCount)
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [locationsQ.data])

  // Точки с наибольшим числом активных заявок (ADMIN → locations, прочие → context).
  const topLocations = useMemo<Array<[string, number]>>(() => {
    if (isAnalyticsAdmin) {
      const items = locationsQ.data?.items
      if (!items) return []
      return items
        .map((l) => [l.locationName, l.newTickets + l.inProgressTickets] as [string, number])
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
  }, [isAnalyticsAdmin, locationsQ.data, contextQ.data])

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

  const scope = scopeParams
  const homeHref = api.appendScopeToPath(mobilePath(location.pathname, ''), scope, meQ.data)

  const fmt = (n: number | null | undefined) => (n == null ? '—' : String(n))
  const maxCat = topCategories[0]?.[1] || 1
  const maxLoc = topLocations[0]?.[1] || 1
  const statusMax = Math.max(1, ...statusRows.map((r) => r.value ?? 0))
  const pct = (n: number, max: number) => Math.round((n / max) * 100)

  // Загрузка/ошибка релевантных для роли запросов.
  const primaryQ = isAnalyticsAdmin ? overviewQ : contextQ
  const kpiLoading = primaryQ.isLoading

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Аналитика</h1>
        <div className="mobileSubtitle">Сводка по текущему контуру заявок</div>
      </div>

      {/* KPI */}
      <div className="mobileAnalyticsGrid">
        <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--active">
          <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.active)}</div>
          <div className="mobileAnalyticsLabel">Активные заявки</div>
        </div>
        {isAnalyticsAdmin ? (
          <>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--overdue">
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.overdue)}</div>
              <div className="mobileAnalyticsLabel">Просрочено</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--done">
              <div className="mobileAnalyticsValue">{fmt(kpi.done)}</div>
              <div className="mobileAnalyticsLabel">Выполнено</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--sla">
              <div className="mobileAnalyticsValue">
                {kpiLoading ? '…' : kpi.slaPercent == null ? '—' : `${kpi.slaPercent}%`}
              </div>
              <div className="mobileAnalyticsLabel">SLA соблюдён</div>
            </div>
          </>
        ) : (
          <>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--done">
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.done)}</div>
              <div className="mobileAnalyticsLabel">Выполнено</div>
            </div>
            <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--active">
              <div className="mobileAnalyticsValue">{kpiLoading ? '…' : fmt(kpi.total)}</div>
              <div className="mobileAnalyticsLabel">Всего заявок</div>
            </div>
          </>
        )}
      </div>

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

      {/* Топ категорий (только ADMIN — разбивка есть в /analytics/locations) */}
      {isAnalyticsAdmin ? (
        <div className="mobileCard">
          <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Топ категорий проблем</div>
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

      {/* Точки с наибольшим числом активных заявок */}
      <div className="mobileCard">
        <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Точки с наибольшим числом активных заявок</div>
        {(isAnalyticsAdmin ? locationsQ.isSuccess : contextQ.isSuccess) && topLocations.length > 0 ? (
          <div className="mobileAnalyticsBarRows">
            {topLocations.map(([name, count]) => (
              <div key={name} className="mobileAnalyticsBarRow">
                <span className="mobileAnalyticsBarName">{name}</span>
                <span className="mobileAnalyticsBarCount">{count}</span>
                <div className="mobileAnalyticsBarTrack">
                  <div
                    className="mobileAnalyticsBarFill mobileAnalyticsBarFill--location"
                    style={{ width: `${pct(count, maxLoc)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mobileMeta">
            {(isAnalyticsAdmin ? locationsQ.isLoading : contextQ.isLoading) ? 'Загрузка…' : 'Нет данных'}
          </div>
        )}
      </div>

      {/* Распределение по статусам */}
      <div className="mobileCard">
        <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Распределение по статусам</div>
        <div className="mobileAnalyticsBarRows">
          {statusRows.map(({ label, value, mod }) => (
            <div key={mod} className="mobileAnalyticsBarRow">
              <span className="mobileAnalyticsBarName">{label}</span>
              <span className="mobileAnalyticsBarCount">{fmt(value)}</span>
              <div className="mobileAnalyticsBarTrack">
                <div
                  className={`mobileAnalyticsBarFill mobileAnalyticsBarFill--${mod}`}
                  style={{ width: `${value == null ? 0 : pct(value, statusMax)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mobileMeta" style={{ textAlign: 'center', opacity: 0.7 }}>
        <Link to={homeHref} className="mobileAnalyticsHomeLink" style={{ color: 'inherit' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          На главную
        </Link>
      </div>
    </div>
  )
}
