import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  applyAppBadge,
  canUsePush,
  registerPushServiceWorker,
  subscribeToServiceWorkerMessages,
} from '../lib/pushNotifications'

type PushNavigateMessage = {
  type?: string
  requestId?: string
  target?: string
  url?: string
  targetRoute?: string
  ticketId?: string
  notificationType?: string
  count?: number
}

function sameOriginPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  try {
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin) return null
    if (!url.pathname.startsWith('/')) return null
    return `${url.pathname}${url.search}${url.hash}` || '/m'
  } catch {
    return null
  }
}

function isMobileRoute() {
  const pathname = window.location.pathname
  return pathname === '/m' || pathname.startsWith('/m/') || pathname === '/max' || pathname.startsWith('/max/')
}

function isChatNotification(value: unknown) {
  if (typeof value !== 'string') return false
  const type = value.toLowerCase()
  return type.includes('chat') || type.includes('comment') || type.includes('attachment')
}

function ticketTarget(msg: PushNavigateMessage): string | null {
  if (typeof msg.ticketId !== 'string' || !msg.ticketId.trim()) return null
  const base = isMobileRoute()
    ? `/m/tickets/${encodeURIComponent(msg.ticketId.trim())}`
    : `/tickets/${encodeURIComponent(msg.ticketId.trim())}`
  if (!isChatNotification(msg.notificationType)) return base
  const url = new URL(base, window.location.origin)
  url.searchParams.set('tab', 'chat')
  return `${url.pathname}${url.search}`
}

function navigationTarget(msg: PushNavigateMessage): string | null {
  return sameOriginPath(msg.target) || sameOriginPath(msg.url) || sameOriginPath(msg.targetRoute) || ticketTarget(msg)
}

function ackPushNavigation(requestId: string | undefined, ok: boolean, target?: string) {
  if (!requestId) return
  try {
    const message = { type: 'push-navigate-ack', requestId, ok, target }
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message)
      return
    }
    void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage(message))
  } catch {
    /* ACK is best-effort; SW still has WindowClient.navigate fallback. */
  }
}

/**
 * Мост Service Worker ↔ приложение (mobile-поток, push-уведомления).
 *  1. Регистрирует push-SW на СТАРТЕ приложения (идемпотентно — браузер дедупит register
 *     по одному scope), чтобы push активировался без визита на /push-settings.
 *  2. Слушает postMessage от SW (web/public/sw.js):
 *       - { type: 'push-navigate', target } → роутер переходит на нужный экран (при ОТКРЫТОМ app);
 *       - { type: 'push-badge-update', count } → Badging API (счётчик на иконке PWA).
 * Рендерит null; монтируется один раз внутри роутера. Слушатель снимается при размонтировании.
 */
export function PushServiceWorkerBridge() {
  const navigate = useNavigate()
  const handledRequestIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!canUsePush()) return
    // 1. Регистрация SW на старте (register идемпотентен для одного scope).
    void registerPushServiceWorker()

    // 2 + 3. Обработка сообщений SW.
    const off = subscribeToServiceWorkerMessages((data) => {
      if (!data || typeof data !== 'object') return
      const msg = data as PushNavigateMessage
      if (msg.type === 'push-navigate') {
        const target = navigationTarget(msg)
        if (!target) {
          ackPushNavigation(msg.requestId, false)
          return
        }
        if (msg.requestId && handledRequestIdsRef.current.has(msg.requestId)) {
          ackPushNavigation(msg.requestId, true, target)
          return
        }
        if (msg.requestId) handledRequestIdsRef.current.add(msg.requestId)
        navigate(target)
        ackPushNavigation(msg.requestId, true, target)
      } else if (msg.type === 'push-badge-update' && typeof msg.count === 'number') {
        applyAppBadge(msg.count)
      }
    })
    return off
  }, [navigate])

  return null
}
