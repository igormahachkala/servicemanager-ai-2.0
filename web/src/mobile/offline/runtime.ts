/**
 * SMA-MOBILE-OFFLINE-INTEGRATION-113D.
 *
 * Единая точка входа для экранов. Экран не собирает координатор, не открывает
 * хранилище и не подписывается на `online` — всё это живёт здесь, в одном
 * экземпляре на приложение.
 *
 * Почему так: событие `online` приходит пачками, и если каждый экран заведёт
 * свою подписку, при возвращении связи запустится столько обработчиков,
 * сколько открыто экранов. Координатор 113C от повторного запуска защищён,
 * но плодить подписки всё равно незачем.
 *
 * Своего менеджера сокета здесь нет: realtime остаётся за 112A. При
 * восстановлении связи оба механизма дёргаются одним и тем же событием,
 * и синхронизация с переподключением не конкурируют — очередь разбирает
 * единственный координатор.
 */

import { createHttpSyncTransport } from './transport.js'
import { openOfflineSession, wipeOfflineSession, currentOfflineStore } from './session.js'
import { SyncCoordinator } from './sync.js'
import type { OfflineStore } from './store.js'
import { OFFLINE_SYNC_LABEL, type OfflineQueueItem } from './types.js'

export type OfflineStatus = {
  /** Хранилище доступно и офлайн-работа сохранится. */
  ready: boolean
  online: boolean
  pending: number
  attention: number
  syncing: boolean
  /** Русское объяснение, если офлайн-режим недоступен. */
  unavailableReason?: string
}

type Listener = (status: OfflineStatus) => void

let store: OfflineStore | null = null
let coordinator: SyncCoordinator | null = null
let identityKey: string | null = null
let connectivityWatched = false
const listeners = new Set<Listener>()

let status: OfflineStatus = {
  ready: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  pending: 0,
  attention: 0,
  syncing: false,
}

/**
 * Слежение за связью ставится один раз на приложение и не зависит от того,
 * удалось ли открыть хранилище. Индикатор «Онлайн/Офлайн» в шапке обязан
 * оставаться честным даже там, где IndexedDB недоступна, — иначе техник
 * увидит «Онлайн» в подвале без связи.
 */
function watchConnectivity() {
  if (connectivityWatched || typeof window === 'undefined') return
  connectivityWatched = true
  window.addEventListener('online', () => {
    emit({ online: true })
    void syncNow()
  })
  window.addEventListener('offline', () => emit({ online: false }))
}

export function getOfflineStatus(): OfflineStatus {
  watchConnectivity()
  return status
}

export function subscribeOfflineStatus(listener: Listener): () => void {
  watchConnectivity()
  listeners.add(listener)
  listener(status)
  return () => listeners.delete(listener)
}

function emit(patch: Partial<OfflineStatus>) {
  status = { ...status, ...patch }
  for (const listener of listeners) listener(status)
}

export async function refreshOfflineStatus(): Promise<OfflineStatus> {
  if (!store) return status
  const [pending, attention] = await Promise.all([store.pendingCount(), store.attentionCount()])
  emit({ pending, attention, syncing: coordinator?.isRunning ?? false })
  return status
}

/**
 * Открыть офлайн-режим под текущего пользователя. Вызывается один раз при
 * входе в мобильную оболочку; повторный вызов для того же пользователя
 * ничего не пересоздаёт.
 */
export async function startOffline(identity: { id?: string | null; companyId?: string | null } | null) {
  const key = identity ? `${identity.companyId}:${identity.id}` : null
  if (key && key === identityKey && store) return { store, status }

  // Смена пользователя: старую подписку снимаем, иначе она продолжит
  // разбирать очередь уже закрытого хранилища.
  stopOffline()

  watchConnectivity()
  const opened = await openOfflineSession(identity)
  identityKey = key
  store = opened.store
  emit({ ready: opened.available, unavailableReason: opened.unavailableReason })

  if (!opened.available || !store) return { store, status }

  coordinator = new SyncCoordinator(store, createHttpSyncTransport())

  await refreshOfflineStatus()
  // Работа могла накопиться в прошлой сессии — разбираем сразу, если связь есть.
  if (status.online) void syncNow()
  return { store, status }
}

export function stopOffline() {
  coordinator = null
  store = null
  identityKey = null
  emit({ ready: false, pending: 0, attention: 0, syncing: false })
}

export async function syncNow(): Promise<void> {
  if (!coordinator || !store) return
  emit({ syncing: true })
  try {
    await coordinator.run()
  } finally {
    await refreshOfflineStatus()
    emit({ syncing: false })
  }
}

export function offlineStore(): OfflineStore | null {
  return store ?? currentOfflineStore()
}

/**
 * Поставить операцию в очередь и честно сказать, сохранилась ли она.
 * Экран обязан показать результат: «Сохранено на устройстве» только при ok.
 */
export async function queueOffline(input: Parameters<OfflineStore['enqueue']>[0]) {
  const s = offlineStore()
  if (!s || !s.available) {
    return {
      ok: false as const,
      message: status.unavailableReason || 'Офлайн-хранилище недоступно: работа не сохранена',
      quota: false,
    }
  }
  const result = await s.enqueue(input)
  await refreshOfflineStatus()
  if (result.ok && status.online) void syncNow()
  return result
}

export async function listOfflineQueue(): Promise<OfflineQueueItem[]> {
  const s = offlineStore()
  return s ? s.listQueue() : []
}

/**
 * Есть ли неотправленная работа. Нужна выходу из учётной записи: выход
 * удаляет приватные данные вместе с очередью, и предупредить об этом надо
 * до того, как пользователь подтвердит выход.
 */
export async function hasUnsentWork(): Promise<{ unsent: number; attention: number }> {
  const s = offlineStore()
  if (!s) return { unsent: 0, attention: 0 }
  const items = await s.listQueue()
  return {
    unsent: items.filter((i) => i.status === 'pending' || i.status === 'failed' || i.status === 'syncing').length,
    attention: items.filter((i) => i.status === 'attention').length,
  }
}

/**
 * Выход: синхронизация останавливается, приватные данные удаляются.
 * Вызывать только после подтверждения пользователем, если работа не ушла.
 */
export async function wipeOfflineOnLogout(identity: { id?: string | null; companyId?: string | null } | null) {
  stopOffline()
  await wipeOfflineSession(identity)
}

export { OFFLINE_SYNC_LABEL }
