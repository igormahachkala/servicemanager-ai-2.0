import type { PushPreference } from '../lib/api'
import type { PushPlatform } from '../lib/pushNotifications'

export type PushEnableErrorKind =
  | 'permission_denied'
  | 'backend_not_ready'
  | 'subscription_error'
  | 'backend_error'

export type PushEnableResult =
  | {
      ok: true
      permission: NotificationPermission
      subscribed: true
      preferences: PushPreference
    }
  | {
      ok: false
      permission: NotificationPermission
      subscribed: boolean
      errorKind: PushEnableErrorKind
      message: string
    }

type SerializedPushSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export type PushEnableDeps = {
  requestPermission: () => Promise<NotificationPermission>
  registerServiceWorker: () => Promise<ServiceWorkerRegistration | null>
  getExistingSubscription: () => Promise<PushSubscription | null>
  subscribeToPush: (vapidPublicKey: string) => Promise<PushSubscription | null>
  serializeSubscription: (sub: PushSubscription) => SerializedPushSubscription
  saveSubscription: (payload: SerializedPushSubscription & { platform: PushPlatform; declarative: boolean }) => Promise<unknown>
  updatePreferences: (patch: Partial<PushPreference>) => Promise<PushPreference>
  refreshCanonicalState: () => Promise<void>
}

export const PUSH_ENABLE_PREFS: PushPreference = {
  chat: true,
  ticketNew: true,
  assignment: true,
  statusChange: true,
  acceptance: true,
  acceptanceReject: true,
  sla: true,
  news: false,
}

const DEFAULT_TIMEOUT_MS = 15_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export function pushEnableMessage(kind: PushEnableErrorKind): string {
  if (kind === 'permission_denied') {
    return 'Разрешение на уведомления не выдано. Включите его в настройках браузера и попробуйте снова.'
  }
  if (kind === 'backend_not_ready') {
    return 'Бэкенд push ещё не готов: отсутствует VAPID-ключ. Разрешение сохранено в браузере, подписку можно повторить позже.'
  }
  if (kind === 'subscription_error') {
    return 'Не удалось оформить подписку в этом браузере. Проверьте Service Worker и попробуйте ещё раз.'
  }
  return 'Подписка создана в браузере, но сервер не подтвердил сохранение. Нажмите «Включить уведомления» ещё раз.'
}

export async function enablePushNotifications(params: {
  vapidPublicKey?: string | null
  platform: PushPlatform
  deps: PushEnableDeps
  timeoutMs?: number
}): Promise<PushEnableResult> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const permission = await params.deps.requestPermission()
  if (permission !== 'granted') {
    return {
      ok: false,
      permission,
      subscribed: false,
      errorKind: 'permission_denied',
      message: pushEnableMessage('permission_denied'),
    }
  }

  const vapidPublicKey = (params.vapidPublicKey || '').trim()
  if (!vapidPublicKey) {
    return {
      ok: false,
      permission,
      subscribed: false,
      errorKind: 'backend_not_ready',
      message: pushEnableMessage('backend_not_ready'),
    }
  }

  let sub: PushSubscription | null = null
  try {
    await withTimeout(params.deps.registerServiceWorker(), timeoutMs, 'Service Worker registration timeout')
    sub = await withTimeout(params.deps.getExistingSubscription(), timeoutMs, 'Push subscription lookup timeout')
    if (!sub) {
      sub = await withTimeout(params.deps.subscribeToPush(vapidPublicKey), timeoutMs, 'Push subscription timeout')
    }
  } catch {
    return {
      ok: false,
      permission,
      subscribed: false,
      errorKind: 'subscription_error',
      message: pushEnableMessage('subscription_error'),
    }
  }

  if (!sub) {
    return {
      ok: false,
      permission,
      subscribed: false,
      errorKind: 'subscription_error',
      message: pushEnableMessage('subscription_error'),
    }
  }

  try {
    const payload = params.deps.serializeSubscription(sub)
    await withTimeout(
      params.deps.saveSubscription({ ...payload, platform: params.platform, declarative: false }),
      timeoutMs,
      'Push backend save timeout',
    )
    const preferences = await withTimeout(
      params.deps.updatePreferences(PUSH_ENABLE_PREFS),
      timeoutMs,
      'Push preference update timeout',
    )
    await withTimeout(params.deps.refreshCanonicalState(), timeoutMs, 'Push state refresh timeout')
    return { ok: true, permission, subscribed: true, preferences }
  } catch {
    return {
      ok: false,
      permission,
      subscribed: true,
      errorKind: 'backend_error',
      message: pushEnableMessage('backend_error'),
    }
  }
}
