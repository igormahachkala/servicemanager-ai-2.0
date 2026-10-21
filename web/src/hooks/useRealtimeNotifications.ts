import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  canUseBrowserNotifications,
  getBrowserNotificationsEnabled,
  showBrowserNotification,
} from '../lib/browserNotifications'
import { pushRichToast } from '../lib/appToast'
import { shouldShowNotificationToast, type WsNotifMsg } from '../lib/realtimeNotificationToast'
import { resolveNotificationSourcePath, type NotificationSurface } from '../lib/notificationNavigation'

/**
 * Returns a stable callback to pass to useWsInvalidation({ onNotification }).
 *
 * @param surface  Current shell surface used to translate canonical notification targets.
 */
export function useRealtimeNotifications(surface: NotificationSurface = 'mobile') {
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useCallback(
    (msg: WsNotifMsg) => {
      const { notificationId, notificationType } = msg

      if (!notificationId) return
      if (!shouldShowNotificationToast(notificationId)) return

      const href = resolveNotificationSourcePath(msg, surface) || undefined

      const title = api.getNotificationTypeLabel(notificationType || '')

      pushRichToast({
        title,
        body: href ? 'Нажмите, чтобы открыть заявку' : undefined,
        tone: 'info',
        onClick: href
          ? () => {
              api.markNotificationRead(notificationId).catch(() => {})
              qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
              navigate(href!)
            }
          : undefined,
      })

      if (!canUseBrowserNotifications()) return
      if (!getBrowserNotificationsEnabled()) return
      if (Notification.permission !== 'granted') return

      showBrowserNotification({
        title,
        body: href ? 'Нажмите, чтобы открыть заявку' : undefined,
        onClick: href
          ? () => {
              api.markNotificationRead(notificationId).catch(() => {})
              qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
              navigate(href!)
            }
          : undefined,
      })
    },
    // surface is a string literal passed from each shell — stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, qc, surface],
  )
}
