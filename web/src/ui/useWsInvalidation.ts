import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import type { WsNotifMsg } from '../lib/realtimeNotificationToast'
import { configureRealtimeSocket, subscribeRealtimeSocket } from '../lib/realtimeSocket'

type WsBoardScope = {
  linkedClientCompanyId?: string
  companyId?: string
}

type UseWsInvalidationOpts = {
  /** Called once per new notification WS message; responsible for showing a toast. */
  onNotification?: (msg: WsNotifMsg) => void
}

function defaultWsUrl() {
  const base = api.getBaseUrl()
  const wsBase = base.replace(/^http/i, 'ws')
  return `${wsBase}/ws`
}

function hasTarget(msg: unknown, target: string) {
  const targets = (msg as { targets?: unknown } | null)?.targets
  return Array.isArray(targets) && targets.includes(target)
}

function isNotFoundQueryError(error: unknown) {
  return error instanceof api.ApiRequestError && error.status === 404
}

function invalidateUnlessGone(qc: QueryClient, queryKey: unknown[]) {
  const matches = qc.getQueryCache().findAll({ queryKey })
  if (matches.length === 0) {
    qc.invalidateQueries({ queryKey })
    return
  }
  for (const query of matches) {
    if (isNotFoundQueryError(query.state.error)) {
      qc.removeQueries({ queryKey: query.queryKey })
    } else {
      qc.invalidateQueries({ queryKey: query.queryKey })
    }
  }
}

function applyTicketInvalidation(qc: QueryClient, ticketId?: string) {
  qc.invalidateQueries({ queryKey: ['board'] })
  qc.invalidateQueries({ queryKey: ['tickets'] })
  qc.invalidateQueries({ queryKey: ['mobile-home-board'] })
  qc.invalidateQueries({ queryKey: ['mobile-home-available'] })
  qc.invalidateQueries({ queryKey: ['mobile-my-board'] })

  if (!ticketId) {
    qc.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
    qc.invalidateQueries({ queryKey: ['mobile-ticket-timeline'] })
    qc.invalidateQueries({ queryKey: ['mobile-ticket-attachments'] })
    return
  }

  invalidateUnlessGone(qc, ['ticket', ticketId])
  invalidateUnlessGone(qc, ['timeline', ticketId])
  invalidateUnlessGone(qc, ['mobile-ticket-detail', ticketId])
  invalidateUnlessGone(qc, ['mobile-ticket-timeline', ticketId])
  invalidateUnlessGone(qc, ['mobile-ticket-attachments', ticketId])
}

export function useWsInvalidation(scope?: WsBoardScope, opts?: UseWsInvalidationOpts) {
  const qc = useQueryClient()
  const onNotificationRef = useRef(opts?.onNotification)

  useEffect(() => {
    onNotificationRef.current = opts?.onNotification
  }, [opts?.onNotification])

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl()
    configureRealtimeSocket({
      url: wsUrl,
      token: api.getToken(),
      scope: {
        companyId: scope?.companyId,
        linkedClientCompanyId: scope?.linkedClientCompanyId,
      },
    })
  }, [scope?.companyId, scope?.linkedClientCompanyId])

  useEffect(
    () =>
      subscribeRealtimeSocket((msg) => {
        const t = typeof msg.type === 'string' ? msg.type : ''
        if (t === 'invalidate' && (hasTarget(msg, 'board') || hasTarget(msg, 'tickets') || hasTarget(msg, 'ticket'))) {
          applyTicketInvalidation(qc, typeof msg.ticketId === 'string' ? msg.ticketId : undefined)
        }

        if (t === 'invalidate' && hasTarget(msg, 'notifications')) {
          qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
        }

        if (t === 'notifications.invalidate') {
          qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
          onNotificationRef.current?.(msg as WsNotifMsg)
        }

        if (t.startsWith('notifications.') && t !== 'notifications.invalidate') {
          qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
        }

        if (t.startsWith('ticket.') || t.includes('ticket')) {
          applyTicketInvalidation(qc, typeof msg.ticketId === 'string' ? msg.ticketId : undefined)
          if (hasTarget(msg, 'notifications')) qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
        }
      }),
    [qc],
  )
}
