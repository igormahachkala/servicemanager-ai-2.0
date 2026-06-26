import { Link } from 'react-router-dom'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function WorkspaceNotifications({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()
  const unread = snapshot.notifications.filter((item) => !item.read)

  return (
    <Panel
      title={t.employeeWorkspace.sections.notifications}
      right={
        <Link to="/ops/notifications" className="mcBtn mcBtnSecondary mcBtnSm">
          {t.employeeWorkspace.openNotifications}
        </Link>
      }
    >
      <div className="mcProfilePanelBody">
        {snapshot.notifications.length === 0 ? (
          <p className="mcMuted">{t.employeeWorkspace.empty.notifications}</p>
        ) : (
          <ul className="acWorkspaceNotificationList">
            {snapshot.notifications.map((notification) => (
              <li key={notification.id} className={notification.read ? '' : 'acWorkspaceNotificationUnread'}>
                <Link
                  to={notification.action?.href ?? '/ops/notifications'}
                  className="acWorkspaceNotificationItem"
                >
                  <span>{notification.title}</span>
                  <span className="mcMuted">{notification.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {unread.length > 0 ? (
          <p className="mcMuted acWorkspaceUnreadNote">
            {t.employeeWorkspace.unreadCount.replace('{count}', String(unread.length))}
          </p>
        ) : null}
      </div>
    </Panel>
  )
}
