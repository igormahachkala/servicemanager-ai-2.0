/**
 * Снимок площадки в IndexedDB (namespace пользователя).
 *
 * Кэшируется то, что техник уже открыл (карточка заявки с location,
 * список создания заявки). Зеркалить весь каталог локаций не нужно.
 */

import { offlineStore } from './runtime.js'

type LocationSnapshot = { id: string } & Record<string, unknown>

export async function cacheLocationSnapshot(location: LocationSnapshot): Promise<void> {
  const store = offlineStore()
  if (!store || !location?.id) return
  await store.cacheLocation(location)
}

export async function readLocationSnapshot<T extends LocationSnapshot>(locationId: string): Promise<T | null> {
  const store = offlineStore()
  if (!store || !locationId) return null
  return store.readLocation<T>(locationId)
}
