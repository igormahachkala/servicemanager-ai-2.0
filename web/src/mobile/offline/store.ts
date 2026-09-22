/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113C.
 *
 * Очередь операций, кэш рабочего пакета и хранение снимков поверх драйвера.
 *
 * Здесь держатся три правила, ради которых задача и делалась.
 *
 * 1. Пока сервер не подтвердил — не говорить, что подтвердил. Постановка
 *    в очередь возвращает результат записи, и если хранилище отказало,
 *    вызывающий код обязан показать ошибку, а не «Сохранено на устройстве».
 *
 * 2. Ключ идемпотентности создаётся один раз, вместе со строкой очереди,
 *    и дальше не меняется никогда: ни при перезагрузке, ни при повторе,
 *    ни при переподключении. Иначе повтор создаст дубль — ровно то, что 113B
 *    призван исключить.
 *
 * 3. История локальной работы не теряется. Отказ, который нельзя повторять,
 *    уводит строку в «Требует внимания», но не удаляет её.
 */

import type { OfflineDriver } from './driver.js'
import {
  OFFLINE_OPERATIONS,
  type OfflineOperationKind,
  type OfflineQueueItem,
  type OfflineQueueStatus,
} from './types.js'

export type EnqueueInput = {
  kind: OfflineOperationKind
  target: OfflineQueueItem['target']
  payload?: Record<string, unknown>
  blob?: Blob
  dependsOnId?: string
  producesTicketId?: boolean
}

/**
 * Результат постановки в очередь. Отказ — обычное значение, а не исключение:
 * вызывающий код обязан его увидеть и не показать «Сохранено на устройстве».
 */
export type EnqueueResult =
  | { ok: true; item: OfflineQueueItem }
  | { ok: false; message: string; quota: boolean }

/** Локальная заявка до синхронизации. Префикс отличает её от серверного id. */
export const LOCAL_ID_PREFIX = 'local:'

export function isLocalId(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(LOCAL_ID_PREFIX)
}

function randomId(): string {
  const globalCrypto = (globalThis as { crypto?: Crypto }).crypto
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Ключ идемпотентности. Генерируется здесь и только здесь — в момент создания
 * строки очереди. Повторная отправка берёт ключ из строки, а не создаёт новый.
 */
function newIdempotencyKey(kind: OfflineOperationKind): string {
  return `${kind}:${randomId()}`
}

function targetSignature(item: Pick<OfflineQueueItem, 'kind' | 'target'>): string {
  const t = item.target
  return [item.kind, t.ticketId ?? '', t.roundId ?? '', t.checkpointId ?? ''].join('|')
}

export class OfflineStore {
  readonly driver: OfflineDriver
  readonly namespace: string

  constructor(driver: OfflineDriver, namespace: string) {
    this.driver = driver
    this.namespace = namespace
  }

  get available(): boolean {
    return this.driver.available
  }

  // ── очередь ─────────────────────────────────────────────────────────────

  async listQueue(): Promise<OfflineQueueItem[]> {
    const items = await this.driver.getAll<OfflineQueueItem>('queue')
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  }

  async getQueueItem(id: string): Promise<OfflineQueueItem | null> {
    return this.driver.get<OfflineQueueItem>('queue', id)
  }

  /**
   * Постановка в очередь. Возвращает результат, а не бросает: вызывающий код
   * обязан различить «сохранено на устройстве» и «сохранить не удалось».
   */
  async enqueue(input: EnqueueInput): Promise<EnqueueResult> {
    const spec = OFFLINE_OPERATIONS[input.kind]
    if (!spec) return { ok: false, message: `Неизвестная операция: ${input.kind}`, quota: false }

    const now = new Date().toISOString()

    // Схлопывание по цели: у чек-поинта и статуса заявки серверу нужно
    // последнее значение, а не цепочка промежуточных. Ключ идемпотентности
    // при этом сохраняется от первой строки — она та же операция.
    if (spec.collapseByTarget) {
      const signature = targetSignature(input)
      const existing = (await this.listQueue()).find(
        (row) => row.status === 'pending' && targetSignature(row) === signature,
      )
      if (existing) {
        const merged: OfflineQueueItem = {
          ...existing,
          payload: { ...(input.payload ?? {}) },
          updatedAt: now,
          lastError: undefined,
        }
        const write = await this.driver.put('queue', merged.id, merged)
        if (!write.ok) return { ok: false, message: write.message, quota: write.reason === 'quota' }
        return { ok: true, item: merged }
      }
    }

    const id = randomId()
    let blobId: string | undefined

    // Blob пишется до строки очереди. Обратный порядок оставил бы очередь
    // со ссылкой на снимок, которого нет.
    if (input.blob) {
      blobId = `blob:${id}`
      const write = await this.driver.put('blobs', blobId, {
        id: blobId,
        blob: input.blob,
        size: input.blob.size,
        type: input.blob.type,
        createdAt: now,
      })
      if (!write.ok) {
        return { ok: false, message: write.message, quota: write.reason === 'quota' }
      }
    }

    const item: OfflineQueueItem = {
      id,
      kind: input.kind,
      idempotencyKey: newIdempotencyKey(input.kind),
      target: input.target,
      payload: input.payload ?? {},
      blobId,
      dependsOnId: input.dependsOnId,
      producesTicketId: input.producesTicketId,
      status: 'pending',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    }

    const write = await this.driver.put('queue', id, item)
    if (!write.ok) {
      // Строка не сохранилась — снимок тоже не должен остаться сиротой.
      if (blobId) await this.driver.delete('blobs', blobId)
      return { ok: false, message: write.message, quota: write.reason === 'quota' }
    }
    return { ok: true, item }
  }

  /** Обновление строки. Ключ идемпотентности не перезаписывается никогда. */
  async updateQueueItem(
    id: string,
    patch: Partial<Omit<OfflineQueueItem, 'id' | 'idempotencyKey' | 'createdAt'>>,
  ): Promise<OfflineQueueItem | null> {
    const current = await this.getQueueItem(id)
    if (!current) return null
    const next: OfflineQueueItem = {
      ...current,
      ...patch,
      id: current.id,
      idempotencyKey: current.idempotencyKey,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    }
    const write = await this.driver.put('queue', id, next)
    if (!write.ok) return current
    return next
  }

  async setStatus(id: string, status: OfflineQueueStatus, extra: Partial<OfflineQueueItem> = {}) {
    return this.updateQueueItem(id, { status, ...extra })
  }

  /**
   * Удаление строки после подтверждённой синхронизации. Снимок удаляется
   * только здесь: пока сервер не подтвердил, локальный Blob — единственная
   * копия работы техника.
   */
  async removeSynced(id: string): Promise<void> {
    const item = await this.getQueueItem(id)
    if (!item) return
    if (item.status !== 'synced') return
    if (item.blobId) await this.driver.delete('blobs', item.blobId)
    await this.driver.delete('queue', id)
  }

  async pendingCount(): Promise<number> {
    return (await this.listQueue()).filter((i) => i.status === 'pending' || i.status === 'failed').length
  }

  async attentionCount(): Promise<number> {
    return (await this.listQueue()).filter((i) => i.status === 'attention').length
  }

  // ── снимки ──────────────────────────────────────────────────────────────

  async getBlob(blobId: string): Promise<Blob | null> {
    const row = await this.driver.get<{ blob: Blob }>('blobs', blobId)
    return row?.blob ?? null
  }

  async listBlobIds(): Promise<string[]> {
    const rows = await this.driver.getAll<{ id: string }>('blobs')
    return rows.map((r) => r.id)
  }

  // ── рабочий пакет ───────────────────────────────────────────────────────
  //
  // Кэшируется только то, с чем техник работает прямо сейчас. Зеркалить
  // серверную базу на устройство не нужно и вредно: объём и приватность.

  async cacheTicket(ticket: { id: string } & Record<string, unknown>) {
    return this.driver.put('tickets', ticket.id, ticket)
  }
  async readTicket<T>(id: string): Promise<T | null> {
    return this.driver.get<T>('tickets', id)
  }
  async cacheRound(round: { id: string } & Record<string, unknown>) {
    return this.driver.put('rounds', round.id, round)
  }
  async readRound<T>(id: string): Promise<T | null> {
    return this.driver.get<T>('rounds', id)
  }
  async cacheCheckpoint(checkpoint: { id: string } & Record<string, unknown>) {
    return this.driver.put('checkpoints', checkpoint.id, checkpoint)
  }
  async readCheckpoints<T>(): Promise<T[]> {
    return this.driver.getAll<T>('checkpoints')
  }
  async cacheLocation(location: { id: string } & Record<string, unknown>) {
    return this.driver.put('locations', location.id, location)
  }
  async readLocation<T>(id: string): Promise<T | null> {
    return this.driver.get<T>('locations', id)
  }

  // ── метаданные синхронизации ────────────────────────────────────────────

  async getMeta<T>(key: string): Promise<T | null> {
    return this.driver.get<T>('meta', key)
  }
  async setMeta(key: string, value: unknown) {
    return this.driver.put('meta', key, value)
  }

  /**
   * Соответствие локальной заявки серверной. Нужна, чтобы зависимые операции
   * (фото и комментарии к заявке из обхода) ушли на настоящий идентификатор.
   */
  async mapLocalTicket(localId: string, serverId: string) {
    const map = (await this.getMeta<Record<string, string>>('ticketIdMap')) ?? {}
    map[localId] = serverId
    return this.setMeta('ticketIdMap', map)
  }
  async resolveTicketId(id?: string): Promise<string | undefined> {
    if (!id || !isLocalId(id)) return id
    const map = (await this.getMeta<Record<string, string>>('ticketIdMap')) ?? {}
    return map[id]
  }

  /** Полная очистка пространства имён. Применяется при выходе. */
  async destroy(): Promise<void> {
    await this.driver.destroy()
  }
}
