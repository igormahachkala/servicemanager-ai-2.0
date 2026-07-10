import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  applyAppBadge,
  canUsePush,
  registerPushServiceWorker,
  subscribeToServiceWorkerMessages,
} from '../lib/pushNotifications'

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

  useEffect(() => {
    if (!canUsePush()) return
    // 1. Регистрация SW на старте (register идемпотентен для одного scope).
    void registerPushServiceWorker()

    // 2 + 3. Обработка сообщений SW.
    const off = subscribeToServiceWorkerMessages((data) => {
      if (!data || typeof data !== 'object') return
      const msg = data as { type?: string; target?: string; count?: number }
      if (msg.type === 'push-navigate' && typeof msg.target === 'string' && msg.target) {
        navigate(msg.target)
      } else if (msg.type === 'push-badge-update' && typeof msg.count === 'number') {
        applyAppBadge(msg.count)
      }
    })
    return off
  }, [navigate])

  return null
}
