import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { NotificationFilters } from '../components/notifications/NotificationFilters'
import { NotificationInbox } from '../components/notifications/NotificationInbox'
import { NOTIFICATION_CATEGORIES } from '../domain/notifications/notification'
import type { NotificationCategory } from '../domain/notifications/notification'
import { useNotifications } from '../hooks/useNotifications'
import { useI18n } from '../i18n'

export function NotificationsPage() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const { filtered, stats, query, setQuery, filter, setFilter, markRead, markAllRead } =
    useNotifications()

  useEffect(() => {
    const type = searchParams.get('type')
    if (type && (NOTIFICATION_CATEGORIES as readonly string[]).includes(type)) {
      setFilter((current) => ({ ...current, type: type as NotificationCategory }))
    }
  }, [searchParams, setFilter])

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.notifications} description={t.notificationEngine.pageDescription} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="mcBtn mcBtnSecondary" onClick={markAllRead}>
            {t.notificationEngine.markAllRead}
          </button>
          <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
            {t.pages.companyTimeline}
          </Link>
        </div>
      </div>

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.notificationEngine.stats.total}</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.notificationEngine.stats.unread}</div>
          <div className="mcMetricValue">{stats.unread}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.notificationEngine.stats.approval}</div>
          <div className="mcMetricValue">{stats.approval}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.notificationEngine.stats.runtime}</div>
          <div className="mcMetricValue">{stats.runtime}</div>
        </div>
      </div>

      <Panel
        title={t.notificationEngine.inboxTitle}
        right={
          <span className="mcMono mcMuted">
            {filtered.length} {t.notificationEngine.itemCount}
          </span>
        }
      >
        <div className="mcProfilePanelBody mcStack">
          <label className="mcField mcMemorySearch">
            <span className="mcFieldLabel">{t.notificationEngine.searchLabel}</span>
            <input
              className="mcInput"
              type="search"
              value={query}
              placeholder={t.notificationEngine.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <NotificationFilters filter={filter} onChange={(patch) => setFilter({ ...filter, ...patch })} />
          <NotificationInbox items={filtered} onMarkRead={markRead} onMarkAllRead={markAllRead} />
        </div>
      </Panel>

      <p className="mcReportPrincipleNote">{t.notificationEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.notificationEngine.localOnly}</p>
    </>
  )
}
