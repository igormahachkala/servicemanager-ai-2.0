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
import { identityFromToken } from './identity.js'
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
  /**
   * 005: отправка остановлена до сети — чужая личность или закрытая сессия.
   * Работа цела, но сама она не уйдёт, и интерфейс обязан это сказать.
   */
  blockedReason?: string
}

type Listener = (status: OfflineStatus) => void

let store: OfflineStore | null = null
let coordinator: SyncCoordinator | null = null
let identityKey: string | null = null
let connectivityWatched = false

/**
 * SMA-OFFLINE-QUEUE-OWNER-IDENTITY-HARDENING-005.
 *
 * Поколение сессии. Растёт на каждом stopOffline — то есть при смене
 * пользователя, выходе и размонтировании оболочки. Координатор, запущенный
 * в прошлом поколении, сравнивает своё число с этим и останавливается перед
 * следующей строкой: обнулить его ссылки снаружи нельзя, он держит их сам.
 */
let generation = 0

/**
 * 005: личность, которую предъявит запрос. Берётся из того же токена, каким
 * уйдёт очередь, — значит расхождения между «чья работа» и «от чьего имени
 * отправляем» быть не может.
 *
 * `lib/api` подключается лениво по той же причине, что и в транспорте: слой
 * очереди собирается узким tsconfig, и верхнеуровневый импорт сломал бы ту
 * сборку.
 */
async function liveIdentityNamespace(): Promise<string | null> {
  try {
    const api = await import('../../lib/api')
    const identity = identityFromToken(api.getToken())
    return identity ? `${identity.companyId}:${identity.id}` : null
  } catch {
    // Модуль не прочитали — доказать принадлежность нечем, значит не отправляем.
    return null
  }
}

/**
 * Повтор с нарастающей паузой.
 *
 * Событие `online` приходит раньше, чем связь действительно работает: радио
 * ещё поднимается, и первый же запрос падает с «Failed to fetch». Одного
 * такого отказа хватало, чтобы работа техника осталась на устройстве
 * навсегда — другого события `online` в тот выход в зону покрытия не будет,
 * и очередь разбиралась бы только вручную, если человек заметит баннер.
 * Обнаружено живой приёмкой 113D на Stage.
 *
 * Паузы растут, чтобы не долбить сервер в туннеле. Число попыток ограничено
 * самим координатором: после MAX_AUTO_ATTEMPTS строка переходит в «Ошибка
 * отправки» и ждёт человека — автоповтор не бесконечен.
 */
const RETRY_STEPS_MS = [4000, 12000, 40000, 120000]
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryStep = 0

function cancelRetry() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  retryStep = 0
}

function scheduleRetry() {
  if (retryTimer || !coordinator || !status.online) return
  const delay = RETRY_STEPS_MS[Math.min(retryStep, RETRY_STEPS_MS.length - 1)]
  retryStep += 1
  retryTimer = setTimeout(() => {
    retryTimer = null
    void syncNow()
  }, delay)
}
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
    // Счётчик пауз сбрасывается: это новый выход в зону покрытия.
    cancelRetry()
    void syncNow()
  })
  window.addEventListener('offline', () => {
    emit({ online: false })
    // Без сети повторять нечего: следующий круг закажет событие `online`.
    cancelRetry()
  })
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

  const startedAt = generation
  coordinator = new SyncCoordinator(store, createHttpSyncTransport(), {
    resolveIdentity: liveIdentityNamespace,
    isCancelled: () => generation !== startedAt,
  })

  await refreshOfflineStatus()
  // Работа могла накопиться в прошлой сессии — разбираем сразу, если связь есть.
  if (status.online) void syncNow()
  return { store, status }
}

export function stopOffline() {
  cancelRetry()
  // 005: сначала логическая отмена, потом обнуление ссылок. Обратный порядок
  // оставил бы идущий круг без возможности узнать, что его уже не ждут.
  generation += 1
  coordinator?.cancel()
  coordinator = null
  store = null
  identityKey = null
  emit({ ready: false, pending: 0, attention: 0, syncing: false })
}

export async function syncNow(): Promise<void> {
  if (!coordinator || !store) return
  emit({ syncing: true })
  let stoppedReason: string | undefined
  try {
    const report = await coordinator.run()
    stoppedReason = report.stoppedReason
  } finally {
    await refreshOfflineStatus()
    emit({ syncing: false, blockedReason: stoppedReason })
    /*
     * Осталась неотправленная работа — назначаем следующий круг сами.
     * Ждать второго события `online` нельзя: его может не быть.
     *
     * 005: круг, оборванный по личности или отмене, автоповтором не лечится —
     * его разблокирует вход нужным пользователем, а не время. Повторять
     * каждые четыре секунды значило бы крутить цикл впустую до конца сессии.
     */
    if (stoppedReason) cancelRetry()
    else if (status.online && status.pending > 0) scheduleRetry()
    else cancelRetry()
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
