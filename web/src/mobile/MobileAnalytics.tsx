import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mobilePath } from './mobileRoute'

const ACTIVE_STATUSES = new Set(['NEW', 'ASSIGNED', 'IN_PROGRESS'])

/**
 * SMA-MOBILE-122: лёгкий мобильный экран аналитики.
 * Источник — существующий board endpoint (как на главной), без новых API.
 * Показывает: Активные / Просроченные / Выполненные / SLA (под риском).
 */
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
    const active = cols
      .filter((c) => ACTIVE_STATUSES.has(c.status))
      .reduce((sum, c) => sum + (c.total || 0), 0)
    // Просрочено и под риском считаем только среди активных колонок.
    const activeCols = cols.filter((c) => ACTIVE_STATUSES.has(c.status))
    const overdue = activeCols.reduce((sum, c) => sum + (c.sla?.breached || 0), 0)
    const atRisk = activeCols.reduce((sum, c) => sum + (c.sla?.atRisk || 0), 0)
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
    }
  }, [boardQ.data])

  const isLoading = boardQ.isLoading || boardQ.isFetching
  const isError = boardQ.isError
  const ready = boardQ.isSuccess && !!boardQ.data
  const val = (n: number) => (ready ? String(n) : '—')

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

      {/* Главные метрики */}
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

      {/* Разбивка по статусам */}
      <div className="mobileCard">
        <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>По статусам</div>
        <div className="mobileAnalyticsRows">
          <div className="mobileAnalyticsRow"><span className="mobileMeta">Новые</span><span>{val(stats.newCount)}</span></div>
          <div className="mobileAnalyticsRow"><span className="mobileMeta">Назначенные</span><span>{val(stats.assigned)}</span></div>
          <div className="mobileAnalyticsRow"><span className="mobileMeta">В работе</span><span>{val(stats.inProgress)}</span></div>
          <div className="mobileAnalyticsRow"><span className="mobileMeta">Выполненные</span><span>{val(stats.done)}</span></div>
          {ready && stats.canceled > 0 ? (
            <div className="mobileAnalyticsRow"><span className="mobileMeta">Отменённые</span><span>{val(stats.canceled)}</span></div>
          ) : null}
          <div className="mobileAnalyticsRow"><span className="mobileMeta">Всего</span><span style={{ fontWeight: 700 }}>{val(stats.total)}</span></div>
        </div>
      </div>

      {/* Ссылка на полную аналитику (десктоп) */}
      <Link to={api.appendScopeToPath('/analytics', { linkedClientCompanyId: linkedClientCompanyId || undefined, companyId: companyId || undefined }, meQ.data)} className="mobileCard mobileAnalyticsMoreLink">
        <span>Подробная аналитика</span>
        <span aria-hidden>›</span>
      </Link>

      <div className="mobileMeta" style={{ textAlign: 'center', opacity: 0.7 }}>
        {/* keep mobilePath import used; deep links keep scope */}
        <Link to={api.appendScopeToPath(mobilePath(location.pathname, ''), undefined, meQ.data)} style={{ color: 'inherit' }}>
          ← На главную
        </Link>
      </div>
    </div>
  )
}
