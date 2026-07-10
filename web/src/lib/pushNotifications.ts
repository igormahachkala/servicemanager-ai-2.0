/**
 * Push-уведомления (Web Push) — фронтенд-часть, mobile-поток.
 * См. docs/PUSH_NOTIFICATIONS_ARCHITECTURE_V1.md §5.
 *
 * Отличие от src/lib/browserNotifications.ts:
 *  - browserNotifications.ts = `new Notification()` только пока вкладка жива (foreground/realtime).
 *  - этот модуль = настоящий Web Push через Service Worker: доставка при ЗАКРЫТОМ приложении.
 */

export type PushPlatform = 'android' | 'ios-pwa' | 'ios-browser' | 'desktop' | 'other'

const SW_PATH = '/sw.js'

export function canUsePush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

/** iOS/iPadOS: PWA должна быть добавлена на экран «Домой» и открыта в standalone-режиме. */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone
  if (typeof iosStandalone === 'boolean') return iosStandalone
  return window.matchMedia?.('(display-mode: standalone)')?.matches ?? false
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function detectPushPlatform(): PushPlatform {
  if (typeof navigator === 'undefined') return 'other'
  if (isIos()) return isStandalonePwa() ? 'ios-pwa' : 'ios-browser'
  if (/android/i.test(navigator.userAgent)) return 'android'
  if (/win|mac|linux/i.test(navigator.platform || '')) return 'desktop'
  return 'other'
}

/** true только если push технически возможен на этом устройстве прямо сейчас (не «нет», а «блокировано условием»). */
export function isPushBlockedByPlatform(): boolean {
  return detectPushPlatform() === 'ios-browser'
}

export function getPushPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied'
  return Notification.permission
}

/** ВАЖНО: вызывать только из обработчика клика — на iOS вызов при загрузке страницы игнорируется молча. */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUsePush()) return null
  try {
    return await navigator.serviceWorker.register(SW_PATH)
  } catch {
    return null
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!canUsePush()) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!canUsePush()) return null
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  })
}

export async function unsubscribeFromPush(): Promise<{ endpoint: string | null; ok: boolean }> {
  const sub = await getExistingPushSubscription()
  if (!sub) return { endpoint: null, ok: true }
  const endpoint = sub.endpoint
  const ok = await sub.unsubscribe()
  return { endpoint, ok }
}

export function serializeSubscription(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } }
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' },
  }
}
