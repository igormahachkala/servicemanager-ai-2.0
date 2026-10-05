/**
 * Кэш доски заявок в IndexedDB (namespace текущего пользователя).
 *
 * Заменяет общий localStorage-ключ `sm_mobile_board_cache_v1`: на общем
 * планшете следующий техник без сети больше не видит чужую доску.
 */

import { offlineStore, waitForOfflineStore } from './runtime.js'
import { boardCacheScopeKey, type TicketScopeLike } from './cacheKeys.js'

export type OfflineBoardCacheEntry<T = unknown> = {
  savedAt: string
  data: T
}

export async function saveBoardCache<T>(
  scope: TicketScopeLike | undefined,
  data: T,
): Promise<void> {
  const store = offlineStore()
  if (!store) return
  await store.cacheBoardEntry(boardCacheScopeKey(scope), {
    savedAt: new Date().toISOString(),
    data,
  })
}

export async function loadBoardCache<T>(
  scope?: TicketScopeLike,
): Promise<OfflineBoardCacheEntry<T> | null> {
  const store = offlineStore()
  if (!store) return null
  return store.readBoardEntry<OfflineBoardCacheEntry<T>>(boardCacheScopeKey(scope))
}

/** Чтение доски для queryFn: ждёт открытия store, чтобы reload offline не промахивался. */
export async function readCachedBoard<T>(scope?: TicketScopeLike): Promise<T | null> {
  await waitForOfflineStore()
  const cached = await loadBoardCache<T>(scope)
  return cached?.data ?? null
}
