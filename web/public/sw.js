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
    data: { navigate: payload.navigate || '/m' },
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
  const target = (event.notification.data && event.notification.data.navigate) || '/m'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Если вкладка уже открыта — фокусируем и просим роутер перейти на target
        if ('focus' in client) {
          client.postMessage({ type: 'push-navigate', target })
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
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
