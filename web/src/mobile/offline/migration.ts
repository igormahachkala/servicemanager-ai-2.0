/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113C + legacy owner policy.
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
 * подтверждённой записи всех строк, которые можно безопасно забрать.
 *
 * Политика владельца (продуктовое решение B, 2026-09-29).
 *
 * Глобальный ключ не разделён по пользователю. Нельзя брать правило
 * «кто открыл — тот владелец»: на общем планшете чужая очередь ушла бы
 * на сервер под чужим токеном. Строка переносится только если у неё есть
 * доказуемый owner и он совпадает с namespace текущего хранилища
 * (`companyId:userId`). Строки без доказуемого owner остаются в
 * localStorage и автоматически не синхронизируются.
 */

import type { OfflineStore } from './store.js'
import type { OfflineQueueItem, OfflineQueueStatus } from './types.js'

export const LEGACY_QUEUE_KEY = 'sm_mobile_offline_queue_v1'
const MIGRATION_FLAG = 'legacyQueueMigrated:v1'

/** Форма строки из 113A/прежней реализации (+ опциональные поля владельца). */
type LegacyItem = {
  id?: string
  type?: string
  ticketId?: string
  scope?: { companyId?: string; userId?: string; linkedClientCompanyId?: string } | unknown
  payload?: { status?: string; comment?: string; userId?: string }
  createdAt?: string
  status?: string
  lastError?: string
  /** Явный владелец, если когда-либо записывался. */
  owner?: string
  userId?: string
  companyId?: string
}

export type LegacyStorage = Pick<Storage, 'getItem' | 'removeItem'> &
  Partial<Pick<Storage, 'setItem'>>

export type MigrationReport = {
  migrated: number
  skipped: number
  /** Строки оставлены в localStorage: владельца доказать нельзя или он чужой. */
  ownerDenied: number
  /** true — перенос для этого namespace уже выполнялся раньше. */
  alreadyDone: boolean
  /** Исходные данные оставлены на месте (orphans и/или отказ записи). */
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

/**
 * Владелец legacy-строки, если его можно доказать из самих данных.
 * Без userId + companyId (или явного owner) доказательств нет — null.
 */
export function provableLegacyOwner(row: LegacyItem): string | null {
  const explicit = (row.owner || '').trim()
  if (explicit.includes(':')) return explicit

  const scope = asRecord(row.scope)
  const companyId = String(
    row.companyId ?? scope?.companyId ?? '',
  ).trim()
  const userId = String(
    row.userId ?? scope?.userId ?? row.payload?.userId ?? '',
  ).trim()
  if (!companyId || !userId) return null
  return `${companyId}:${userId}`
}

export async function migrateLegacyQueue(
  store: OfflineStore,
  storage: LegacyStorage | null,
): Promise<MigrationReport> {
  const report: MigrationReport = {
    migrated: 0,
    skipped: 0,
    ownerDenied: 0,
    alreadyDone: false,
    sourceKept: false,
  }

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

  const remaining: LegacyItem[] = []
  let allOwnedWritten = true

  for (let i = 0; i < legacy.length; i += 1) {
    const row = legacy[i]
    const kind = mapLegacyKind(row.type)
    const status = mapLegacyStatus(row.status)

    // Уже отправленные и бессмысленные переносить незачем.
    if (!kind || status === 'synced' || !row.ticketId) {
      report.skipped += 1
      continue
    }

    const owner = provableLegacyOwner(row)
    if (!owner || owner !== store.namespace) {
      // Без доказуемого совпадения с текущим пользователем строку не берём:
      // она останется в localStorage для владельца или явной уборки.
      report.ownerDenied += 1
      remaining.push(row)
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
      // Источник не трогаем: иначе при отказе записи очередь разъедется
      // с IndexedDB. Отметку о завершении не ставим — повторим позже.
      allOwnedWritten = false
      break
    }
    // Прежние строки не имели ключа идемпотентности: он создаётся сейчас,
    // при переносе, и дальше уже не меняется.
    if (status === 'failed') {
      await store.setStatus(result.item.id, 'failed', { lastError: row.lastError })
    }
    report.migrated += 1
  }

  if (!allOwnedWritten) {
    report.sourceKept = true
    return report
  }

  // Для этого namespace перенос сделан: чужие/бездонные строки не наши.
  await store.setMeta(MIGRATION_FLAG, true)

  if (remaining.length === 0) {
    try {
      storage.removeItem(LEGACY_QUEUE_KEY)
    } catch {
      report.sourceKept = true
    }
    return report
  }

  report.sourceKept = true
  if (typeof storage.setItem === 'function') {
    try {
      storage.setItem(LEGACY_QUEUE_KEY, JSON.stringify(remaining))
    } catch {
      // Исходник целиком уже на месте — хуже не стало.
    }
  }

  return report
}
