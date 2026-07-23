// Сервис Менеджер — Push Service Worker
// Зона: mobile-поток (frontend). Не трогает offline-очередь заявок — это отдельный
// механизм в src/mobile/offlineQueue.ts, работающий на уровне приложения, не SW.
//
// Что делает этот файл:
//  1. push          — показывает системное уведомление (или ждёт подписки заново, если payload пуст)
//  2. notificationclick — фокусирует/открывает вкладку и переходит в нужный тред
//  3. pushsubscriptionchange — на iOS подписки иногда «пропадают»; здесь переподписываемся
//     и пробуем сообщить бэкенду (если бэкенд ещё не готов — тихо проглатываем ошибку)

const DEFAULT_ICON = '/icons/icon-192.png'
const DEFAULT_BADGE = '/icons/icon-192.png'
const DEFAULT_TARGET = '/m'
const PUSH_NAVIGATION_ACK_TIMEOUT_MS = 900

function safeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function sameOriginPath(value) {
  const raw = safeString(value)
  if (!raw) return ''
  try {
    const url = new URL(raw, self.location.origin)
    if (url.origin !== self.location.origin) return ''
    if (!url.pathname.startsWith('/')) return ''
    return `${url.pathname}${url.search}${url.hash}` || DEFAULT_TARGET
  } catch {
    return ''
  }
}

function isMobileClient(client) {
  try {
    const url = new URL(client.url)
    return url.pathname === '/m' || url.pathname.startsWith('/m/') || url.pathname === '/max' || url.pathname.startsWith('/max/')
  } catch {
    return true
  }
}

function isChatNotification(notificationType) {
  const type = safeString(notificationType).toLowerCase()
  return type.includes('chat') || type.includes('comment') || type.includes('attachment')
}

function withScope(path, payload) {
  const linkedClientCompanyId = safeString(payload.linkedClientCompanyId)
  const companyId = safeString(payload.companyId)
  if (!linkedClientCompanyId && !companyId) return path
  try {
    const url = new URL(path, self.location.origin)
    if (linkedClientCompanyId && !url.searchParams.has('linkedClientCompanyId')) {
      url.searchParams.set('linkedClientCompanyId', linkedClientCompanyId)
    }
    if (companyId && !url.searchParams.has('companyId')) {
      url.searchParams.set('companyId', companyId)
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return path
  }
}

function ticketTarget(payload, client) {
  const ticketId = safeString(payload.ticketId)
  if (!ticketId) return ''
  const base = isMobileClient(client) ? `/m/tickets/${encodeURIComponent(ticketId)}` : `/tickets/${encodeURIComponent(ticketId)}`
  if (!isChatNotification(payload.notificationType)) return withScope(base, payload)
  const url = new URL(base, self.location.origin)
  url.searchParams.set('tab', 'chat')
  return withScope(`${url.pathname}${url.search}`, payload)
}

function notificationTarget(payload, client) {
  const ticketPath = ticketTarget(payload, client)
  const explicit = sameOriginPath(payload.url) || sameOriginPath(payload.targetRoute) || sameOriginPath(payload.navigate)
  if (ticketPath && explicit.startsWith('/m/tickets/') && !isMobileClient(client)) return ticketPath
  return withScope(explicit || ticketPath || DEFAULT_TARGET, payload)
}

function pushNavigationRequestId() {
  return `push-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function waitForNavigationAck(requestId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      self.removeEventListener('message', onMessage)
      resolve(false)
    }, PUSH_NAVIGATION_ACK_TIMEOUT_MS)

    function onMessage(event) {
      const data = event.data || {}
      if (data.type !== 'push-navigate-ack' || data.requestId !== requestId) return
      clearTimeout(timer)
      self.removeEventListener('message', onMessage)
      resolve(data.ok !== false)
    }

    self.addEventListener('message', onMessage)
  })
}

function pickWindowClient(clientList) {
  const sameOrigin = clientList.filter((client) => {
    try {
      return new URL(client.url).origin === self.location.origin
    } catch {
      return false
    }
  })
  return (
    sameOrigin.find((client) => client.focused) ||
    sameOrigin.find((client) => client.visibilityState === 'visible') ||
    sameOrigin[0] ||
    clientList[0]
  )
}

self.addEventListener('install', () => {
  // Не ждём — новый SW должен активироваться сразу же после обновления кода.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/**
 * Ожидаемый payload (см. docs/PUSH_NOTIFICATIONS_ARCHITECTURE_V1.md §2а/§3):
 * {
 *   title: string,
 *   body?: string,
 *   icon?: string,
 *   tag?: string,        // ключ группировки — id чата/треда (схлопывает серию сообщений)
 *   navigate?: string,   // куда вести при клике, напр. /m/tickets/123?tab=chat
 *   badge?: number,      // счётчик непрочитанных для Badging API
 *   silent?: boolean,
 * }
 */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    // Если payload не JSON — показываем как есть текстом, не роняем обработчик.
    payload = { title: 'Сервис Менеджер', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Сервис Менеджер'
  const options = {
    body: payload.body || '',
    icon: payload.icon || DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: payload.tag || undefined, // группировка сообщений одного чата в одно уведомление
    renotify: !!payload.tag,
    silent: !!payload.silent,
    data: {
      navigate: payload.navigate || payload.url || payload.targetRoute || undefined,
      url: payload.url || undefined,
      targetRoute: payload.targetRoute || undefined,
      ticketId: payload.ticketId || undefined,
      notificationType: payload.notificationType || undefined,
      linkedClientCompanyId: payload.linkedClientCompanyId || undefined,
      companyId: payload.companyId || undefined,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))

  // Badging API — счётчик на иконке PWA (если поддерживается и есть контролируемый клиент)
  if (typeof payload.badge === 'number' && self.registration.navigationPreload !== undefined) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'push-badge-update', count: payload.badge })
        })
      }),
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const payload = event.notification.data || {}

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      const client = pickWindowClient(clientList)
      if (client) {
        const target = notificationTarget(payload, client)
        const requestId = pushNavigationRequestId()
        const ack = waitForNavigationAck(requestId)
        client.postMessage({
          type: 'push-navigate',
          requestId,
          target,
          ticketId: payload.ticketId || undefined,
          notificationType: payload.notificationType || undefined,
        })
        if ('focus' in client) await client.focus()
        if (await ack) return client
        if ('navigate' in client) {
          const navigated = await client.navigate(target).catch(() => null)
          if (navigated && 'focus' in navigated) return navigated.focus()
        }
        return client
      }
      if (self.clients.openWindow) {
        const target = notificationTarget(payload, null)
        return self.clients.openWindow(target)
      }
      return undefined
    }),
  )
})

// iOS/браузеры иногда молча инвалидируют подписку. Пытаемся переподписаться на том же
// applicationServerKey и сообщить бэкенду; если бэкенд ещё не готов — не мешаем работе SW.
self.addEventListener('pushsubscriptionchange', (event) => {
  const oldKey = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey

  event.waitUntil(
    (async () => {
      try {
        if (!oldKey) return
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: oldKey,
        })
        await fetch('/push/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: newSub.endpoint, keys: newSub.toJSON().keys }),
        }).catch(() => {
          // бэкенд ещё не готов / офлайн — не критично, следующий heartbeat подхватит
        })
      } catch {
        // ничего не можем сделать без взаимодействия пользователя — просто выходим
      }
    })(),
  )
})
