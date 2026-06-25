import { NOTIFICATION_CATEGORIES, NOTIFICATION_SEVERITIES } from '../../domain/notifications/notification'
import type { NotificationFilter } from '../../domain/notifications/notification'
import { useI18n } from '../../i18n'

export function NotificationFilters(props: {
  filter: NotificationFilter
  onChange: (patch: Partial<NotificationFilter>) => void
}) {
  const { t } = useI18n()
  const { filter, onChange } = props

  return (
    <div className="acNotificationFilters">
      <label className="mcField">
        <span className="mcFieldLabel">{t.notificationEngine.filters.category}</span>
        <select
          className="mcInput"
          value={filter.type ?? 'all'}
          onChange={(event) =>
            onChange({ type: event.target.value as NotificationFilter['type'] })
          }
        >
          <option value="all">{t.common.all}</option>
          {NOTIFICATION_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t.notificationEngine.categories[category]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcField">
        <span className="mcFieldLabel">{t.labels.status}</span>
        <select
          className="mcInput"
          value={filter.read ?? 'all'}
          onChange={(event) =>
            onChange({ read: event.target.value as NotificationFilter['read'] })
          }
        >
          <option value="all">{t.common.all}</option>
          <option value="unread">{t.notificationEngine.filters.unread}</option>
          <option value="read">{t.notificationEngine.filters.read}</option>
        </select>
      </label>

      <label className="mcField">
        <span className="mcFieldLabel">{t.notificationEngine.filters.severity}</span>
        <select
          className="mcInput"
          value={filter.severity ?? 'all'}
          onChange={(event) =>
            onChange({ severity: event.target.value as NotificationFilter['severity'] })
          }
        >
          <option value="all">{t.common.all}</option>
          {NOTIFICATION_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {t.notificationEngine.severity[severity]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
