/**
 * Одноразовый перенос legacy-кэшей доски и детальной карточки из localStorage
 * в IndexedDB текущего пользователя.
 *
 * Прежние ключи были общими на браузер. Переносим содержимое в namespace того,
 * кто первым открыл офлайн-сессию, затем удаляем ключи: иначе следующий
 * техник без сети снова прочитал бы чужие заявки.
 */

import type { OfflineStore } from './store.js'
import type { LegacyStorage } from './migration.js'

export const LEGACY_BOARD_CACHE_KEY = 'sm_mobile_board_cache_v1'
export const LEGACY_TICKET_CACHE_KEY = 'sm_mobile_ticket_cache_v1'

const MIGRATION_FLAG = 'legacyUiCachesMigrated:v1'

export type UiCacheMigrationReport = {
  boardEntries: number
  ticketEntries: number
  alreadyDone: boolean
  sourceCleared: boolean
}

function parseRecord(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function isCacheEntry(value: unknown): value is { savedAt: string; data: unknown } {
  if (!value || typeof value !== 'object') return false
  const row = value as { savedAt?: unknown; data?: unknown }
  return typeof row.savedAt === 'string' && 'data' in row
}

export async function migrateLegacyUiCaches(
  store: OfflineStore,
  storage: LegacyStorage | null,
): Promise<UiCacheMigrationReport> {
  const report: UiCacheMigrationReport = {
    boardEntries: 0,
    ticketEntries: 0,
    alreadyDone: false,
    sourceCleared: false,
  }

  if (await store.getMeta<boolean>(MIGRATION_FLAG)) {
    report.alreadyDone = true
    return report
  }
  if (!storage) {
    await store.setMeta(MIGRATION_FLAG, true)
    report.alreadyDone = true
    return report
  }

  let boardRaw: string | null = null
  let ticketRaw: string | null = null
  try {
    boardRaw = storage.getItem(LEGACY_BOARD_CACHE_KEY)
    ticketRaw = storage.getItem(LEGACY_TICKET_CACHE_KEY)
  } catch {
    return report
  }

  const boardMap = parseRecord(boardRaw)
  for (const [key, value] of Object.entries(boardMap)) {
    if (!isCacheEntry(value)) continue
    const write = await store.cacheBoardEntry(key, { savedAt: value.savedAt, data: value.data })
    if (write.ok) report.boardEntries += 1
  }

  const ticketMap = parseRecord(ticketRaw)
  for (const [key, value] of Object.entries(ticketMap)) {
    if (!isCacheEntry(value)) continue
    const write = await store.cacheTicketDetailEntry(key, { savedAt: value.savedAt, data: value.data })
    if (write.ok) report.ticketEntries += 1
  }

  await store.setMeta(MIGRATION_FLAG, true)

  try {
    storage.removeItem(LEGACY_BOARD_CACHE_KEY)
    storage.removeItem(LEGACY_TICKET_CACHE_KEY)
    report.sourceCleared = true
  } catch {
    report.sourceCleared = false
  }

  return report
}
