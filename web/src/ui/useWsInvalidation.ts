import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

type WsBoardScope = {
  linkedClientCompanyId?: string
  companyId?: string
}

function defaultWsUrl() {
  const base = api.getBaseUrl()
  const wsBase = base.replace(/^http/i, 'ws')
  return `${wsBase}/ws`
}

function hasTarget(msg: any, target: string) {
  return Array.isArray(msg?.targets) && msg.targets.includes(target)
}

export function useWsInvalidation(scope?: WsBoardScope) {
  const qc = useQueryClient()

  useEffect(() => {
    const token = api.getToken()
    if (!token) return

    const wsUrl = (import.meta as any).env?.VITE_WS_URL || defaultWsUrl()

    let ws: WebSocket | null = null
    let stopped = false
    let retry = 0
    let retryTimer: any = null

    const connect = () => {
      if (stopped) return
      try {
        ws = new WebSocket(wsUrl)
      } catch {
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        retry = 0
        ws?.send(JSON.stringify({ type: 'auth', token }))
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          const t = msg?.type || ''
          if (t === 'session.ready') {
            ws?.send(JSON.stringify({ type: 'subscribe', scope: 'board', params: scope || {} }))
            ws?.send(JSON.stringify({ type: 'subscribe', scope: 'notifications' }))
            return
          }

          if (t === 'invalidate' && (hasTarget(msg, 'board') || hasTarget(msg, 'tickets') || hasTarget(msg, 'ticket'))) {
            qc.invalidateQueries({ queryKey: ['board'] })
            if (msg.ticketId) qc.invalidateQueries({ queryKey: ['ticket', msg.ticketId] })
            if (msg.ticketId) qc.invalidateQueries({ queryKey: ['timeline', msg.ticketId] })
            qc.invalidateQueries({ queryKey: ['tickets'] })
            qc.invalidateQueries({ queryKey: ['mobile-home-board'] })
            qc.invalidateQueries({ queryKey: ['mobile-home-available'] })
            qc.invalidateQueries({ queryKey: ['mobile-my-board'] })
            qc.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
            qc.invalidateQueries({ queryKey: ['mobile-ticket-timeline'] })
            qc.invalidateQueries({ queryKey: ['mobile-ticket-attachments'] })
          }

          if (t === 'invalidate' && hasTarget(msg, 'notifications')) {
            qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
          }

          if (t.startsWith('notifications.')) {
            qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
          }

          if (t.startsWith('ticket.') || t.includes('ticket')) {
            qc.invalidateQueries({ queryKey: ['board'] })
            if (msg.ticketId) qc.invalidateQueries({ queryKey: ['ticket', msg.ticketId] })
            if (msg.ticketId) qc.invalidateQueries({ queryKey: ['timeline', msg.ticketId] })
            qc.invalidateQueries({ queryKey: ['tickets'] })
            qc.invalidateQueries({ queryKey: ['mobile-home-board'] })
            qc.invalidateQueries({ queryKey: ['mobile-home-available'] })
            qc.invalidateQueries({ queryKey: ['mobile-my-board'] })
            qc.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
            qc.invalidateQueries({ queryKey: ['mobile-ticket-timeline'] })
            qc.invalidateQueries({ queryKey: ['mobile-ticket-attachments'] })
            if (hasTarget(msg, 'notifications')) qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
          }
        } catch {}
      }

      ws.onclose = () => {
        scheduleReconnect()
      }
    }

    const scheduleReconnect = () => {
      if (stopped) return
      if (retryTimer) return
      retry++
      const delay = Math.min(10000, 500 * retry)
      retryTimer = setTimeout(() => {
        retryTimer = null
        connect()
      }, delay)
    }

    connect()

    return () => {
      stopped = true
      if (retryTimer) clearTimeout(retryTimer)
      try {
        ws?.close()
      } catch {}
      ws = null
    }
  }, [qc, scope?.companyId, scope?.linkedClientCompanyId])
}
