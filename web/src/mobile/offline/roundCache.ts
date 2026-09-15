/**
 * SMA-MOBILE-OFFLINE-INTEGRATION-113D.
 *
 * Обход, доступный без сети.
 *
 * Очередь 113C сохраняет действия, но сам обход после перезагрузки страницы
 * взять неоткуда: кэш react-query живёт в памяти вкладки. Поэтому открытый
 * обход складывается в IndexedDB целиком, вместе с чек-поинтами.
 *
 * Поверх сохранённой копии накладываются неотправленные отметки. Без этого
 * техник, перезагрузивший приложение в подвале, увидел бы чек-поинт пустым —
 * и отметил бы его второй раз, хотя первая отметка лежит в очереди.
 */

import { offlineStore } from './runtime.js'
import type { OfflineQueueItem } from './types.js'

/** Минимум, который нужен наложению; полный тип живёт в `lib/api`. */
type RoundItemShape = {
  id: string
  status?: unknown
  requiresRepair?: boolean
  comment?: string | null
  booleanValue?: boolean | null
  numberValue?: number | null
  textValue?: string | null
  /** Проставляется наложением: отметка есть на устройстве, но не на сервере. */
  offlinePending?: boolean
}

type RoundShape = { id: string; items?: RoundItemShape[] }

export async function cacheRoundSnapshot(round: RoundShape): Promise<void> {
  const store = offlineStore()
  if (!store || !round?.id) return
  await store.cacheRound(round as { id: string } & Record<string, unknown>)
  // Чек-поинты дублируются отдельными записями: по ним строится список
  // «незакрытая работа» вне контекста конкретного обхода.
  for (const item of round.items || []) {
    if (item?.id) await store.cacheCheckpoint({ ...item, roundId: round.id })
  }
}

/** Отметки из очереди, которые сервер ещё не подтвердил. */
function applyPendingWork<T extends RoundShape>(round: T, queue: OfflineQueueItem[]): T {
  const forRound = queue.filter(
    (item) => item.kind === 'checkpoint.update' && item.target.roundId === round.id && item.status !== 'synced',
  )
  if (forRound.length === 0 || !round.items) return round

  const patched = round.items.map((item) => {
    const queued = forRound.find((q) => q.target.checkpointId === item.id)
    if (!queued) return item
    return { ...item, ...(queued.payload as Partial<RoundItemShape>), offlinePending: true }
  })
  return { ...round, items: patched }
}

export async function readRoundSnapshot<T extends RoundShape>(runId: string): Promise<T | null> {
  const store = offlineStore()
  if (!store || !runId) return null
  const round = await store.readRound<T>(runId)
  if (!round) return null
  return applyPendingWork(round, await store.listQueue())
}

/**
 * Чек-поинты этого обхода, по которым заявка уже сохранена на устройстве,
 * но сервером ещё не создана. Экран обязан это показать: иначе кнопка
 * «Создать заявку» выглядит несработавшей.
 */
export async function readPendingRoundTicketItemIds(runId: string): Promise<Set<string>> {
  const store = offlineStore()
  if (!store || !runId) return new Set()
  const queue = await store.listQueue()
  return new Set(
    queue
      .filter((i) => i.kind === 'ticket.fromRound' && i.target.roundId === runId && i.status !== 'synced')
      .map((i) => i.target.checkpointId || '')
      .filter(Boolean),
  )
}

export { applyPendingWork }
