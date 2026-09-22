// Сервис Менеджер — Push Service Worker
// Зона: mobile-поток (frontend). Очередь отложенной работы здесь не живёт —
// она в IndexedDB (src/mobile/offline/*), на уровне приложения. SW отвечает
// только за push и за оболочку, которую видно без связи.
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

function clientSurface(client) {
  if (!client) return 'mobile'
  try {
    const url = new URL(client.url)
    if (url.pathname === '/max' || url.pathname.startsWith('/max/')) return 'max'
    if (url.pathname === '/m' || url.pathname.startsWith('/m/')) return 'mobile'
    return 'desktop'
  } catch {
    return 'mobile'
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

function safeTargetObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function canonicalTicketTarget(payload, client) {
  const target = safeTargetObject(payload.navigationTarget)
  if (!target || safeString(target.kind) !== 'ticket') return ''
  const ticketId = safeString(target.ticketId)
  if (!ticketId) return ''

  const surface = clientSurface(client)
  const root = surface === 'desktop' ? '/tickets' : surface === 'max' ? '/max/tickets' : '/m/tickets'
  const url = new URL(`${root}/${encodeURIComponent(ticketId)}`, self.location.origin)
  const section = safeString(target.section)
  if (section && section !== 'overview') url.searchParams.set('section', section)
  if (section === 'comments') url.searchParams.set('tab', 'chat')
  const linkedClientCompanyId = safeString(target.linkedClientCompanyId)
  if (linkedClientCompanyId) url.searchParams.set('linkedClientCompanyId', linkedClientCompanyId)
  const sourceEventId = safeString(target.sourceEventId)
  if (sourceEventId) url.searchParams.set('sourceEventId', sourceEventId)
  return `${url.pathname}${url.search}${url.hash}`
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

function mobilePwaTicketPath(path) {
  const raw = safeString(path)
  if (!raw) return ''
  try {
    const url = new URL(raw, self.location.origin)
    if (url.origin !== self.location.origin) return ''
    if (url.pathname.startsWith('/m/tickets/')) return `${url.pathname}${url.search}${url.hash}`
    if (url.pathname.startsWith('/tickets/')) return `/m${url.pathname}${url.search}${url.hash}`
    return ''
  } catch {
    return ''
  }
}

function notificationTarget(payload, client) {
  const canonical = canonicalTicketTarget(payload, client)
  if (canonical) return withScope(canonical, payload)
  const ticketPath = ticketTarget(payload, client)
  const explicit = sameOriginPath(payload.url) || sameOriginPath(payload.targetRoute) || sameOriginPath(payload.navigate)
  if (!client) {
    return withScope(mobilePwaTicketPath(explicit) || ticketPath || DEFAULT_TARGET, payload)
  }
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

// ── SMA-MOBILE-OFFLINE-MODE-V1-113C: оболочка приложения офлайн ──────────
//
// Задача узкая: если техник уже открывал /m, при пропаже связи приложение
// должно открыться заново, а не показать ошибку браузера. Дальше работает
// offline-слой на IndexedDB.
//
// Кэш здесь — только оболочка. Второй операционной базой он не становится
// намеренно: данные заявок и обходов живут в IndexedDB, где ими управляет
// код с понятными правилами и пространством имён по пользователю. Класть
// авторизованные ответы API в кэш Service Worker нельзя ещё и потому, что
// он общий для всех, кто открывал браузер: на общем планшете следующий
// техник увидел бы чужие данные.
const APP_SHELL_CACHE = 'sma-app-shell-v2'
const APP_SHELL_URL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => Promise.all(
        [APP_SHELL_URL, '/', '/m'].map((url) => cache.add(url).catch(() => undefined)),
      ))
      .catch(() => undefined),
  )
  // Не ждём — новый SW должен активироваться сразу же после обновления кода.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Старые версии оболочки убираем, иначе после релиза техник получит
      // вчерашний бандл.
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('sma-app-shell-') && k !== APP_SHELL_CACHE).map((k) => caches.delete(k))),
      ),
    ]),
  )
})

/**
 * SMA-MOBILE-OFFLINE-INTEGRATION-113D: сборочные файлы оболочки.
 *
 * Одного index.html мало. Экраны грузятся отдельными файлами по требованию,
 * и тот, который техник не открывал до потери связи, взять неоткуда: без
 * сети приложение показывает пустоту вместо экрана. На приёмке так не
 * открывался профиль — то есть и выход из учётной записи.
 *
 * Имена файлов содержат хэш содержимого, поэтому старая версия никогда
 * не выдаётся за новую: после релиза имена меняются, а прежние записи
 * убирает activate вместе со своим кэшем. Личных данных здесь нет —
 * только код приложения, одинаковый для всех.
 */
function isBuildAsset(url) {
  return url.pathname.startsWith('/assets/') && /\.(js|css|woff2?|svg|png|jpg|webp)$/.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const request = event.request

  // Кэшируется навигация и сборочные файлы. Всё остальное — включая любые
  // запросы с Authorization, вызовы api и защищённую раздачу /uploads —
  // идёт в сеть и в кэш не попадает.
  if (request.method !== 'GET') return

  const assetUrl = new URL(request.url)
  if (request.mode !== 'navigate' && assetUrl.origin === self.location.origin && isBuildAsset(assetUrl)) {
    // Сначала кэш: файл неизменяем, ходить за ним по сети незачем.
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit
        return fetch(request).then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
      }),
    )
    return
  }

  if (request.mode !== 'navigate') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/api/')) return

  // Cold-start on iOS must not wait for a network request to time out. Return
  // the installed shell immediately and refresh it in the background. If the
  // shell is not installed yet, the same network promise becomes the first
  // response and retains the explicit 503 fallback.
  const network = fetch(request).then((response) => {
    if (response && response.ok && response.type === 'basic') {
      const copy = response.clone()
      caches.open(APP_SHELL_CACHE).then((cache) => cache.put(APP_SHELL_URL, copy)).catch(() => undefined)
    }
    return response
  })
  event.waitUntil(network.then(() => undefined).catch(() => undefined))
  event.respondWith(
    caches.match(APP_SHELL_URL).then((cached) => {
      if (cached) return cached
      return network.catch(() => new Response('Нет связи и нет сохранённой копии приложения.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }))
    }),
  )
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
      navigationTarget: payload.navigationTarget || undefined,
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
          navigationTarget: payload.navigationTarget || undefined,
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
