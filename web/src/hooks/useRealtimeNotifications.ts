import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { pushRichToast } from '../lib/appToast'
import { shouldShowNotificationToast, type WsNotifMsg } from '../lib/realtimeNotificationToast'

/**
 * Returns a stable callback to pass to useWsInvalidation({ onNotification }).
 *
 * @param ticketBasePath  Route prefix for ticket detail: '/m/tickets/' (mobile, default)
 *                        or '/tickets/' (desktop).
 */
export function useRealtimeNotifications(ticketBasePath = '/m/tickets/') {
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useCallback(
    (msg: WsNotifMsg) => {
      const { notificationId, notificationType, entityType, entityId, linkedClientCompanyId } = msg

      if (!notificationId) return
      if (!shouldShowNotificationToast(notificationId)) return

      // Build navigation target; only Ticket entities are currently navigable
      let href: string | undefined
      if (entityType === 'Ticket' && entityId) {
        href = `${ticketBasePath}${encodeURIComponent(entityId)}`
        if (linkedClientCompanyId) {
          href += `?linkedClientCompanyId=${encodeURIComponent(linkedClientCompanyId)}`
        }
      }

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
    },
    // ticketBasePath is a string literal passed from each shell — stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, qc, ticketBasePath],
  )
}
