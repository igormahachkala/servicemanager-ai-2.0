import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CHANGE_EVENT,
  STORAGE_KEY,
  ensureSeedNotifications,
  filterNotifications,
  getUnreadCount,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  searchNotifications,
  type Notification,
  type NotificationFilter,
} from '../domain/notifications/notificationStorage'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    ensureSeedNotifications()
    return loadNotifications()
  })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<NotificationFilter>({
    type: 'all',
    severity: 'all',
    read: 'all',
  })

  const refresh = useCallback(() => {
    ensureSeedNotifications()
    setNotifications(loadNotifications())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh()
    }
    const onChange = () => refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, onChange)
    }
  }, [refresh])

  const unreadCount = useMemo(() => getUnreadCount(), [notifications])

  const filtered = useMemo(() => {
    const searched = searchNotifications(notifications, query)
    return filterNotifications(searched, filter)
  }, [notifications, query, filter])

  const unread = useMemo(() => notifications.filter((item) => !item.read), [notifications])

  const stats = useMemo(
    () => ({
      total: notifications.length,
      unread: unread.length,
      approval: notifications.filter((item) => item.type === 'approval' && !item.read).length,
      runtime: notifications.filter((item) => item.type === 'runtime' && !item.read).length,
      report: notifications.filter((item) => item.type === 'report' && !item.read).length,
    }),
    [notifications, unread.length],
  )

  const markRead = useCallback(
    (id: string) => {
      markNotificationRead(id)
      refresh()
    },
    [refresh],
  )

  const markAllRead = useCallback(() => {
    markAllNotificationsRead()
    refresh()
  }, [refresh])

  return {
    notifications,
    filtered,
    unread,
    unreadCount,
    stats,
    query,
    setQuery,
    filter,
    setFilter,
    markRead,
    markAllRead,
    refresh,
  }
}
