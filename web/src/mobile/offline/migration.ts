/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113C.
 *
 * Перенос уже стоящей в очереди работы из localStorage в новое хранилище.
 *
 * На устройствах техников прямо сейчас лежит очередь ключа
 * `sm_mobile_offline_queue_v1`: статусы заявок и комментарии, поставленные
 * в офлайне и не отправленные. Если 113C просто начнёт писать в IndexedDB,
 * эта работа осиротеет — формально не потеряется, но никогда не уйдёт
 * на сервер и исчезнет из интерфейса. Поэтому перенос обязателен.
 *
 * Перенос идемпотентен: отметка в `meta` не даёт продублировать строки при
 * повторном запуске, а исходный ключ localStorage удаляется только после
 * подтверждённой записи всех строк.
 */

import type { OfflineStore } from './store.js'
import type { OfflineQueueItem, OfflineQueueStatus } from './types.js'

export const LEGACY_QUEUE_KEY = 'sm_mobile_offline_queue_v1'
const MIGRATION_FLAG = 'legacyQueueMigrated:v1'

/** Форма строки из 113A/прежней реализации. */
type LegacyItem = {
  id?: string
  type?: string
  ticketId?: string
  scope?: unknown
  payload?: { status?: string; comment?: string }
  createdAt?: string
  status?: string
  lastError?: string
}

export type MigrationReport = {
  migrated: number
  skipped: number
  /** true — перенос уже выполнялся раньше, повторно ничего не делали. */
  alreadyDone: boolean
  /** Исходные данные оставлены на месте: часть строк записать не удалось. */
  sourceKept: boolean
}

function mapLegacyStatus(value?: string): OfflineQueueStatus {
  // Прежнее 'syncing' при старте означает прерванную отправку: возвращаем
  // в 'pending', иначе строка зависнет навсегда.
  if (value === 'failed') return 'failed'
  if (value === 'synced') return 'synced'
  return 'pending'
}

function mapLegacyKind(type?: string): OfflineQueueItem['kind'] | null {
  if (!type) return null
  if (type.includes('comment')) return 'ticket.comment'
  if (type.includes('status')) return 'ticket.status'
  if (type.includes('checkpoint')) return 'checkpoint.update'
  return null
}

export async function migrateLegacyQueue(
  store: OfflineStore,
  storage: Pick<Storage, 'getItem' | 'removeItem'> | null,
): Promise<MigrationReport> {
  const report: MigrationReport = { migrated: 0, skipped: 0, alreadyDone: false, sourceKept: false }

  if (await store.getMeta<boolean>(MIGRATION_FLAG)) {
    report.alreadyDone = true
    return report
  }
  if (!storage) return report

  let raw: string | null = null
  try {
    raw = storage.getItem(LEGACY_QUEUE_KEY)
  } catch {
    return report
  }
  if (!raw) {
    // Переносить нечего, но отметку ставим: иначе будем читать localStorage
    // на каждом запуске.
    await store.setMeta(MIGRATION_FLAG, true)
    report.alreadyDone = true
    return report
  }

  let legacy: LegacyItem[] = []
  try {
    const parsed = JSON.parse(raw)
    legacy = Array.isArray(parsed) ? parsed : []
  } catch {
    // Повреждённое содержимое не удаляем: пусть останется следом для разбора.
    return report
  }

  let allWritten = true
  for (const row of legacy) {
    const kind = mapLegacyKind(row.type)
    const status = mapLegacyStatus(row.status)

    // Уже отправленные переносить незачем.
    if (!kind || status === 'synced' || !row.ticketId) {
      report.skipped += 1
      continue
    }

    const payload: Record<string, unknown> = {}
    if (row.payload?.comment) payload.comment = row.payload.comment
    if (row.payload?.status) payload.status = row.payload.status
    if (row.scope) payload.scope = row.scope

    const result = await store.enqueue({
      kind,
      target: { ticketId: row.ticketId },
      payload,
    })
    if (!result.ok) {
      allWritten = false
      break
    }
    // Прежние строки не имели ключа идемпотентности: он создаётся сейчас,
    // при переносе, и дальше уже не меняется.
    if (status === 'failed') {
      await store.setStatus(result.item.id, 'failed', { lastError: row.lastError })
    }
    report.migrated += 1
  }

  if (allWritten) {
    await store.setMeta(MIGRATION_FLAG, true)
    try {
      storage.removeItem(LEGACY_QUEUE_KEY)
    } catch {
      report.sourceKept = true
    }
  } else {
    // Хотя бы одна строка не записалась — источник оставляем нетронутым,
    // чтобы не потерять работу. Отметку о завершении не ставим.
    report.sourceKept = true
  }

  return report
}
