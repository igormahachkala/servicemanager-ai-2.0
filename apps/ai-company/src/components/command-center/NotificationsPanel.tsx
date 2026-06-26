import { Link } from 'react-router-dom'
import type { Notification } from '../../domain/notifications/notification'
import { Badge, Card } from '../layout'
import { formatFeedTime } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  notifications: Notification[]
  unreadCount: number
  onMarkRead: (id: string) => void
}

export function NotificationsPanel({ notifications, unreadCount, onMarkRead }: Props) {
  const { t } = useI18n()

  return (
    <Card
      title={t.commandCenter.sections.notifications}
      action={
        <Link to="/ops/notifications" className="acLink">
          {t.executiveDashboard.viewAll}
          {unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Link>
      }
    >
      {notifications.length === 0 ? (
        <div className="acMuted">{t.notificationEngine.emptyInbox}</div>
      ) : (
        notifications.map((item) => (
          <div key={item.id} className="acListRow">
            <span className="acMono acMuted">{formatFeedTime(item.createdAt)}</span>
            <span>{item.title}</span>
            <Badge variant={item.severity === 'error' ? 'danger' : item.severity === 'warn' ? 'warning' : 'default'}>
              {item.type}
            </Badge>
            {item.action ? (
              <Link to={item.action.href} className="acLink" onClick={() => onMarkRead(item.id)}>
                →
              </Link>
            ) : null}
          </div>
        ))
      )}
    </Card>
  )
}
