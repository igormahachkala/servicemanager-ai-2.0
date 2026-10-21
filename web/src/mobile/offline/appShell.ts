/**
 * SMA-MOBILE-OFFLINE-INTEGRATION-113D.
 *
 * Регистрация Service Worker ради офлайн-оболочки.
 *
 * До 113D `/sw.js` регистрировался только при включении push-уведомлений.
 * Для офлайна это неверно: техник, который push не включал, при пропаже связи
 * получал бы экран ошибки браузера вместо приложения — вся сохранённая на
 * устройстве работа оставалась бы недоступной просто потому, что нечем
 * открыть страницу.
 *
 * Регистрация идемпотентна: браузер вернёт уже существующую, если push-поток
 * зарегистрировал тот же файл раньше. Разрешений она не спрашивает —
 * уведомления по-прежнему включаются отдельно и осознанно.
 */

const SW_PATH = '/sw.js'

export function canUseServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

export async function registerAppShellServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null
  // Незащищённый origin (кроме localhost) Service Worker не допускает —
  // это не ошибка приложения, просто офлайн-оболочки там не будет.
  if (typeof window !== 'undefined' && !window.isSecureContext) return null
  try {
    return await navigator.serviceWorker.register(SW_PATH)
  } catch {
    // Отказ регистрации не ломает работу: очередь живёт в IndexedDB и от SW
    // не зависит. Теряется только возможность открыть приложение без связи.
    return null
  }
}
