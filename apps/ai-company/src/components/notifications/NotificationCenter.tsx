import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { useI18n } from '../../i18n'
import { NotificationBadge } from './NotificationBadge'
import { NotificationInbox } from './NotificationInbox'

export function NotificationCenter() {
  const { t } = useI18n()
  const { unread, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const preview = unread.slice(0, 8)

  return (
    <div className="acNotificationCenter" ref={rootRef}>
      <button
        type="button"
        className="acNotificationBell"
        aria-expanded={open}
        aria-label={t.notificationEngine.bellLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>🔔</span>
        <NotificationBadge count={unreadCount} compact />
      </button>

      {open ? (
        <div className="acNotificationDropdown" role="dialog" aria-label={t.notificationEngine.inboxTitle}>
          <div className="acNotificationDropdownHead">
            <strong>{t.notificationEngine.inboxTitle}</strong>
            <Link to="/ops/notifications" className="acLink" onClick={() => setOpen(false)}>
              {t.notificationEngine.viewInbox}
            </Link>
          </div>
          <NotificationInbox
            items={preview}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            compact
            emptyMessage={t.notificationEngine.emptyInbox}
          />
          <div className="acNotificationQuickActions">
            <Link to="/ops/approvals" className="acQuickActionBtn" onClick={() => setOpen(false)}>
              {t.pages.approvals}
            </Link>
            <Link to="/ops/reports" className="acQuickActionBtn" onClick={() => setOpen(false)}>
              {t.pages.reports}
            </Link>
            <Link to="/ops/chats" className="acQuickActionBtn" onClick={() => setOpen(false)}>
              {t.pages.chats}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
