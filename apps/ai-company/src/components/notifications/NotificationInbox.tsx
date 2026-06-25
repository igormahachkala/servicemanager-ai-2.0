import { Link } from 'react-router-dom'
import type { Notification } from '../../domain/notifications/notification'
import { NotificationCard } from './NotificationCard'
import { useI18n } from '../../i18n'

export function NotificationInbox(props: {
  items: Notification[]
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
  compact?: boolean
  emptyMessage?: string
}) {
  const { t } = useI18n()

  if (props.items.length === 0) {
    return (
      <div className="acNotificationEmpty">
        <p>{props.emptyMessage ?? t.notificationEngine.emptyInbox}</p>
      </div>
    )
  }

  return (
    <div className="acNotificationInbox">
      {props.onMarkAllRead ? (
        <div className="acNotificationInboxToolbar">
          <button type="button" className="mcBtn mcBtnGhost mcBtnSmall" onClick={props.onMarkAllRead}>
            {t.notificationEngine.markAllRead}
          </button>
          <Link to="/ops/notifications" className="acLink">
            {t.notificationEngine.viewInbox}
          </Link>
        </div>
      ) : null}
      <div className="acNotificationInboxList">
        {props.items.map((item) => (
          <NotificationCard
            key={item.id}
            notification={item}
            onMarkRead={props.onMarkRead}
            compact={props.compact}
          />
        ))}
      </div>
    </div>
  )
}
