import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'

const ACTIVE_STATUSES = new Set(['NEW', 'ASSIGNED', 'IN_PROGRESS'])

export function MobileAnalytics() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const linkedClientCompanyId = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return (sp.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  }, [location.search, meQ.data])
  const companyId = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return (sp.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
  }, [location.search, meQ.data])

  const boardQ = useQuery({
    queryKey: ['mobile-analytics-board', linkedClientCompanyId, companyId],
    queryFn: () =>
      api.board({
        linkedClientCompanyId: linkedClientCompanyId || undefined,
        companyId: companyId || undefined,
        take: 500,
      }),
    enabled: !!meQ.data,
  })

  const stats = useMemo(() => {
    const cols = boardQ.data?.columns || []
    const totalFor = (status: string) => cols.find((c) => c.status === status)?.total ?? 0
    const activeCols = cols.filter((c) => ACTIVE_STATUSES.has(c.status))
    const active = activeCols.reduce((sum, c) => sum + (c.total || 0), 0)
    const overdue = activeCols.reduce((sum, c) => sum + (c.sla?.breached || 0), 0)
    const atRisk = activeCols.reduce((sum, c) => sum + (c.sla?.atRisk || 0), 0)

    const categoryMap = new Map<string, number>()
    for (const col of cols) {
      for (const card of col.cards) {
        const cat = card.category?.name || 'Прочее'
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
      }
    }

    const locationMap = new Map<string, number>()
    for (const col of activeCols) {
      for (const card of col.cards) {
        const loc = card.location?.name || card.pointName || 'Без точки'
        locationMap.set(loc, (locationMap.get(loc) || 0) + 1)
      }
    }

    const urgentFromCards = cols.reduce(
      (sum, c) =>
        sum + c.cards.filter((t) => (t.priority ?? 'NORMAL') === 'URGENT' || t.urgency === 'URGENT').length,
      0,
    )

    return {
      active,
      overdue,
      done: totalFor('DONE'),
      atRisk,
      newCount: totalFor('NEW'),
      assigned: totalFor('ASSIGNED'),
      inProgress: totalFor('IN_PROGRESS'),
      canceled: totalFor('CANCELED'),
      total: boardQ.data?.meta?.totalTickets ?? 0,
      topCategories: [...categoryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      topLocations: [...locationMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      urgentFromCards,
    }
  }, [boardQ.data])

  const scope = { linkedClientCompanyId: linkedClientCompanyId || undefined, companyId: companyId || undefined }
  const homeHref = api.appendScopeToPath(mobilePath(location.pathname, ''), scope, meQ.data)

  const isLoading = boardQ.isLoading || boardQ.isFetching
  const isError = boardQ.isError
  const ready = boardQ.isSuccess && !!boardQ.data
  const val = (n: number) => (ready ? String(n) : '—')

  const maxCat = stats.topCategories[0]?.[1] || 1
  const maxLoc = stats.topLocations[0]?.[1] || 1
  const statusMax = Math.max(stats.newCount, stats.assigned, stats.inProgress, stats.done, 1)
  const pct = (n: number, max: number) => (ready ? Math.round((n / max) * 100) : 0)

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Аналитика</h1>
        <div className="mobileSubtitle">Сводка по текущему контуру заявок</div>
      </div>

      {isError ? (
        <div className="mobileNotice mobileNoticeError">
          Не удалось загрузить аналитику. {String((boardQ.error as any)?.message || '')}
        </div>
      ) : null}

      {/* KPI */}
      <div className="mobileAnalyticsGrid">
        <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--active">
          <div className="mobileAnalyticsValue">{isLoading && !ready ? '…' : val(stats.active)}</div>
          <div className="mobileAnalyticsLabel">Активные заявки</div>
        </div>
        <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--overdue">
          <div className="mobileAnalyticsValue">{isLoading && !ready ? '…' : val(stats.overdue)}</div>
          <div className="mobileAnalyticsLabel">Просроченные</div>
        </div>
        <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--done">
          <div className="mobileAnalyticsValue">{isLoading && !ready ? '…' : val(stats.done)}</div>
          <div className="mobileAnalyticsLabel">Выполненные</div>
        </div>
        <div className="mobileCard mobileAnalyticsCard mobileAnalyticsCard--sla">
          <div className="mobileAnalyticsValue">{isLoading && !ready ? '…' : val(stats.atRisk)}</div>
          <div className="mobileAnalyticsLabel">SLA под риском</div>
        </div>
      </div>

      {/* Section 1: Top problem categories */}
      <div className="mobileCard">
        <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Топ категорий проблем</div>
        {ready && stats.topCategories.length > 0 ? (
          <div className="mobileAnalyticsBarRows">
            {stats.topCategories.map(([name, count]) => (
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
          <div className="mobileMeta">{isLoading && !ready ? 'Загрузка…' : 'Нет данных'}</div>
        )}
      </div>

      {/* Section 2: Top locations */}
      <div className="mobileCard">
        <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Точки с наибольшим числом активных заявок</div>
        {ready && stats.topLocations.length > 0 ? (
          <div className="mobileAnalyticsBarRows">
            {stats.topLocations.map(([name, count]) => (
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
          <div className="mobileMeta">{isLoading && !ready ? 'Загрузка…' : 'Нет данных'}</div>
        )}
      </div>

      {/* Section 3: Status distribution */}
      <div className="mobileCard">
        <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Распределение по статусам</div>
        <div className="mobileAnalyticsBarRows">
          {([
            { label: 'Новые', value: stats.newCount, mod: 'new' },
            { label: 'Назначенные', value: stats.assigned, mod: 'assigned' },
            { label: 'В работе', value: stats.inProgress, mod: 'inprogress' },
            { label: 'Выполненные', value: stats.done, mod: 'done' },
          ] as const).map(({ label, value, mod }) => (
            <div key={mod} className="mobileAnalyticsBarRow">
              <span className="mobileAnalyticsBarName">{label}</span>
              <span className="mobileAnalyticsBarCount">{val(value)}</span>
              <div className="mobileAnalyticsBarTrack">
                <div
                  className={`mobileAnalyticsBarFill mobileAnalyticsBarFill--${mod}`}
                  style={{ width: `${pct(value, statusMax)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Quick links */}
      <div className="mobileCard">
        <div className="mobileSectionTitle" style={{ marginBottom: 10 }}>Быстрые переходы</div>
        <div className="mobileAnalyticsQuickLinks">
          <Link to={homeHref} className="mobileAnalyticsQuickLink">
            <span>Все заявки</span>
            <span className="mobileAnalyticsQuickBadge">{val(stats.total)}</span>
          </Link>
          <Link to={homeHref} className="mobileAnalyticsQuickLink">
            <span>Просроченные</span>
            <span className={`mobileAnalyticsQuickBadge${stats.overdue > 0 && ready ? ' mobileAnalyticsQuickBadge--danger' : ''}`}>
              {val(stats.overdue)}
            </span>
          </Link>
          <Link to={homeHref} className="mobileAnalyticsQuickLink">
            <span>Высокий приоритет</span>
            <span className={`mobileAnalyticsQuickBadge${stats.urgentFromCards > 0 && ready ? ' mobileAnalyticsQuickBadge--warning' : ''}`}>
              {ready ? String(stats.urgentFromCards) : '—'}
            </span>
          </Link>
        </div>
      </div>

      <Link
        to={api.appendScopeToPath('/analytics', scope, meQ.data)}
        className="mobileCard mobileAnalyticsMoreLink"
      >
        <span>Подробная аналитика</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

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
