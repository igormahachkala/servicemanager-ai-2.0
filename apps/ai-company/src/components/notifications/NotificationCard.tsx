import { Link } from 'react-router-dom'
import type { Notification } from '../../domain/notifications/notification'
import { useI18n } from '../../i18n'
import { formatFeedTime } from '../../mission-control/components/ui'

export function NotificationCard(props: {
  notification: Notification
  onMarkRead?: (id: string) => void
  compact?: boolean
}) {
  const { t } = useI18n()
  const { notification, onMarkRead, compact } = props

  const severityClass =
    notification.severity === 'error'
      ? 'acNotificationCardDanger'
      : notification.severity === 'warn'
        ? 'acNotificationCardWarn'
        : notification.severity === 'success'
          ? 'acNotificationCardSuccess'
          : ''

  return (
    <article
      className={`acNotificationCard${notification.read ? ' acNotificationCardRead' : ''}${severityClass ? ` ${severityClass}` : ''}${compact ? ' acNotificationCardCompact' : ''}`}
    >
      <div className="acNotificationCardHead">
        <span className="acNotificationCategory">{t.notificationEngine.categories[notification.type]}</span>
        <span className="acMono acMuted">{formatFeedTime(notification.createdAt)}</span>
      </div>
      <h3 className="acNotificationCardTitle">{notification.title}</h3>
      <p className="acNotificationCardSummary">{notification.summary}</p>
      <div className="acNotificationCardActions">
        {notification.action ? (
          <Link
            to={notification.action.href}
            className="mcBtn mcBtnSecondary mcBtnSmall"
            onClick={() => onMarkRead?.(notification.id)}
          >
            {notification.action.label ?? t.notificationEngine.openAction}
          </Link>
        ) : null}
        {!notification.read && onMarkRead ? (
          <button
            type="button"
            className="mcBtn mcBtnGhost mcBtnSmall"
            onClick={() => onMarkRead(notification.id)}
          >
            {t.notificationEngine.markRead}
          </button>
        ) : null}
      </div>
    </article>
  )
}
