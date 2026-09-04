import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import type { WsNotifMsg } from '../lib/realtimeNotificationToast'

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

function hasTarget(msg: any, target: string) {
  return Array.isArray(msg?.targets) && msg.targets.includes(target)
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

function reconnectDelayMs(retry: number) {
  return Math.min(30_000, 500 * 2 ** retry) + Math.floor(Math.random() * 1000)
}

export function useWsInvalidation(scope?: WsBoardScope, opts?: UseWsInvalidationOpts) {
  const qc = useQueryClient()

  useEffect(() => {
    const token = api.getToken()
    if (!token) return

    const wsUrl = (import.meta as any).env?.VITE_WS_URL || defaultWsUrl()

    let ws: WebSocket | null = null
    let stopped = false
    let retry = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let pongTimer: ReturnType<typeof setTimeout> | null = null

    const clearHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
      if (pongTimer) {
        clearTimeout(pongTimer)
        pongTimer = null
      }
    }

    const startHeartbeat = () => {
      clearHeartbeat()
      heartbeatTimer = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        try {
          ws.send(JSON.stringify({ type: 'ping' }))
        } catch {
          return
        }
        if (pongTimer) clearTimeout(pongTimer)
        pongTimer = setTimeout(() => {
          try {
            ws?.close()
          } catch {}
        }, 10_000)
      }, 25_000)
    }

    const connect = () => {
      if (stopped) return
      try {
        ws = new WebSocket(wsUrl)
      } catch {
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'auth', token }))
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          const t = msg?.type || ''
          if (t === 'pong') {
            if (pongTimer) {
              clearTimeout(pongTimer)
              pongTimer = null
            }
            return
          }
          if (t === 'session.ready') {
            retry = 0
            startHeartbeat()
            ws?.send(JSON.stringify({ type: 'subscribe', scope: 'board', params: scope || {} }))
            ws?.send(JSON.stringify({ type: 'subscribe', scope: 'notifications' }))
            return
          }

          if (t === 'invalidate' && (hasTarget(msg, 'board') || hasTarget(msg, 'tickets') || hasTarget(msg, 'ticket'))) {
            applyTicketInvalidation(qc, typeof msg.ticketId === 'string' ? msg.ticketId : undefined)
          }

          if (t === 'invalidate' && hasTarget(msg, 'notifications')) {
            qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
          }

          if (t === 'notifications.invalidate') {
            qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
            opts?.onNotification?.(msg)
          }

          if (t.startsWith('notifications.') && t !== 'notifications.invalidate') {
            qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
          }

          if (t.startsWith('ticket.') || t.includes('ticket')) {
            applyTicketInvalidation(qc, typeof msg.ticketId === 'string' ? msg.ticketId : undefined)
            if (hasTarget(msg, 'notifications')) qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
          }
        } catch {}
      }

      ws.onclose = () => {
        clearHeartbeat()
        scheduleReconnect()
      }
    }

    const scheduleReconnect = () => {
      if (stopped) return
      if (retryTimer) return
      retry++
      const delay = reconnectDelayMs(retry)
      retryTimer = setTimeout(() => {
        retryTimer = null
        connect()
      }, delay)
    }

    connect()

    return () => {
      stopped = true
      if (retryTimer) clearTimeout(retryTimer)
      clearHeartbeat()
      try {
        ws?.close()
      } catch {}
      ws = null
    }
  }, [qc, scope?.companyId, scope?.linkedClientCompanyId, opts?.onNotification])
}
