import { safeGetItem, safeRemoveItem, safeSetItem } from './browserStorage'

const BROWSER_NOTIFICATIONS_ENABLED_KEY = 'browserNotificationsEnabled'

export type BrowserNotificationHandle = {
  close: () => void
}

export function canUseBrowserNotifications(): boolean {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined'
}

export function getBrowserNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return safeGetItem('local', BROWSER_NOTIFICATIONS_ENABLED_KEY, null) === 'true'
}

export function setBrowserNotificationsEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  safeSetItem('local', BROWSER_NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false')
}

export function clearBrowserNotificationsEnabled() {
  if (typeof window === 'undefined') return
  safeRemoveItem('local', BROWSER_NOTIFICATIONS_ENABLED_KEY)
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!canUseBrowserNotifications()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function showBrowserNotification(params: {
  title: string
  body?: string
  icon?: string
  onClick?: () => void
}): BrowserNotificationHandle | null {
  if (!canUseBrowserNotifications()) return null
  if (Notification.permission !== 'granted') return null

  const notification = new Notification(params.title, {
    body: params.body,
    icon: params.icon,
  })

  notification.onclick = (event) => {
    event?.preventDefault?.()
    window.focus()
    params.onClick?.()
    notification.close()
  }

  return {
    close: () => notification.close(),
  }
}
