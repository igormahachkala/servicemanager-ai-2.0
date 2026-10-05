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

import { offlineStore, reportOfflineStorageUnavailable } from './runtime.js'
import type { OfflineQueueItem } from './types.js'
import {
  cacheServerImagesForParent,
  deleteServerMediaForParent,
  isServerImageCandidate,
  retainServerMediaForParent,
  type ServerImageCandidate,
} from './serverMediaCache.js'

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
  attachments?: Array<{
    id?: string | null
    url?: string | null
    originalName?: string | null
    mimeType?: string | null
  }>
}

type RoundShape = { id: string; items?: RoundItemShape[] }

type RoundMediaDeps = {
  resolveUrl: (attachment: { url?: string | null }) => string
  fetchBlob: (url: string) => Promise<Blob | null>
}

async function defaultRoundMediaDeps(): Promise<RoundMediaDeps> {
  const api = await import('../../lib/api')
  return {
    resolveUrl: api.resolveInspectionAttachmentUrl,
    fetchBlob: api.fetchProtectedUploadBlob,
  }
}

export async function cacheRoundSnapshot(round: RoundShape, mediaDeps?: RoundMediaDeps): Promise<void> {
  const store = offlineStore()
  if (!store || !round?.id) return
  const previous = await store.readRound<RoundShape>(round.id)
  const roundWrite = await store.cacheRound(round as { id: string } & Record<string, unknown>)
  if (!roundWrite.ok && (roundWrite.reason === 'quota' || roundWrite.reason === 'unavailable')) {
    reportOfflineStorageUnavailable(roundWrite.message)
    return
  }
  // Чек-поинты дублируются отдельными записями: по ним строится список
  // «незакрытая работа» вне контекста конкретного обхода.
  for (const item of round.items || []) {
    if (!item?.id) continue
    const checkpointWrite = await store.cacheCheckpoint({ ...item, roundId: round.id })
    if (!checkpointWrite.ok && (checkpointWrite.reason === 'quota' || checkpointWrite.reason === 'unavailable')) {
      reportOfflineStorageUnavailable(checkpointWrite.message)
      return
    }
  }

  const previousIds = new Set((previous?.items || []).map((item) => item.id).filter(Boolean))
  const currentIds = new Set((round.items || []).map((item) => item.id).filter(Boolean))
  for (const checkpointId of previousIds) {
    if (!currentIds.has(checkpointId)) {
      await store.deleteCheckpoint(checkpointId)
      await deleteServerMediaForParent({ type: 'checkpoint', id: checkpointId })
    }
  }

  const hasImages = (round.items || []).some((item) =>
    (item.attachments || []).some((attachment) =>
      Boolean(attachment.url) && isServerImageCandidate({
        url: attachment.url || '',
        mimeType: attachment.mimeType,
        fileName: attachment.originalName,
      }),
    ),
  )
  const deps = mediaDeps || (hasImages ? await defaultRoundMediaDeps() : null)
  let mediaComplete = true
  for (const item of round.items || []) {
    if (!item?.id) continue
    const candidates: ServerImageCandidate[] = (item.attachments || []).map((attachment) => ({
      attachmentId: attachment.id || undefined,
      url: deps ? deps.resolveUrl(attachment) : (attachment.url || ''),
      mimeType: attachment.mimeType,
      fileName: attachment.originalName,
    }))
    const media = await cacheServerImagesForParent({
      parent: { type: 'checkpoint', id: item.id },
      candidates,
      fetchBlob: deps?.fetchBlob || (async () => null),
    })
    if (!media.ok) {
      mediaComplete = false
      continue
    }
    await retainServerMediaForParent({ type: 'checkpoint', id: item.id }, media.urls)
  }
  await store.setMeta(`roundMedia:${round.id}`, {
    complete: mediaComplete,
    cachedAt: mediaComplete ? new Date().toISOString() : null,
  })
}

export async function removeRoundSnapshot(roundId: string): Promise<void> {
  const store = offlineStore()
  if (!store || !roundId) return
  const round = await store.readRound<RoundShape>(roundId)
  for (const item of round?.items || []) {
    if (!item?.id) continue
    await store.deleteCheckpoint(item.id)
    await deleteServerMediaForParent({ type: 'checkpoint', id: item.id })
  }
  await deleteServerMediaForParent({ type: 'round', id: roundId })
  await store.deleteMeta(`roundMedia:${roundId}`)
  await store.deleteRound(roundId)
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
