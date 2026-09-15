/**
 * SMA-MOBILE-OFFLINE-INTEGRATION-113D.
 *
 * Настоящая отправка отложенных операций. 113C оставил `SyncTransport`
 * интерфейсом — здесь он подключается к каноническому API.
 *
 * Правило одно и оно жёсткое: ключ идемпотентности берётся из строки очереди
 * и передаётся как есть. Здесь не создаётся ни одного нового ключа — ни при
 * повторе, ни при переподключении. Новый ключ на повторе означал бы второй
 * комментарий, второй снимок или вторую заявку, то есть ровно то, ради чего
 * 113B и делался.
 *
 * Своего HTTP-клиента слой не заводит: всё идёт через существующие функции
 * `lib/api`, которым 113D добавил необязательный параметр ключа.
 */

import type * as ApiModule from '../../lib/api'
import { classifySyncFailure, type OfflineQueueItem, type SyncOutcome } from './types.js'
import type { SyncTransport } from './sync.js'

/**
 * Ровно те функции API, которыми пользуется отправка. Транспорт берёт их
 * параметром, а не импортом-значением: так его поведение (в первую очередь
 * передачу ключа идемпотентности) можно проверить тестом, не поднимая ни
 * сети, ни браузерного окружения. По умолчанию подставляется настоящий
 * `lib/api` — подгружается лениво, чтобы тест не тянул модуль приложения.
 */
export type TransportApi = Pick<
  typeof ApiModule,
  | 'addTicketComment'
  | 'uploadTicketAttachment'
  | 'updateTicketStatus'
  | 'updateInspectionRunItem'
  | 'uploadInspectionRunItemAttachment'
  | 'createTicketFromInspectionItem'
>

/** Разбор ошибки из `lib/api`: там наружу отдаётся Error с текстом сервера. */
function toOutcome(error: unknown): SyncOutcome {
  const message = (error as Error)?.message || String(error)

  // Коды 113B приходят в теле ответа; api.ts кладёт сообщение в Error.
  for (const code of ['IDEMPOTENCY_KEY_CONFLICT', 'IDEMPOTENCY_RESULT_GONE', 'IDEMPOTENCY_IN_PROGRESS']) {
    if (message.includes(code)) return classifySyncFailure({ code, message })
  }

  // HTTP-статус тоже приходит текстом («HTTP 403»), если тела не было.
  const status = /HTTP (\d{3})/.exec(message)?.[1]
  if (status) return classifySyncFailure({ status: Number(status), message })

  // Явные признаки отказа доступа и отсутствия объекта.
  if (/доступ|forbidden/i.test(message)) return classifySyncFailure({ status: 403, message })
  if (/не найден|not found/i.test(message)) return classifySyncFailure({ status: 404, message })

  // Иначе считаем сетевой неудачей: повторить можно.
  return classifySyncFailure({ message })
}

function scopeOf(item: OfflineQueueItem): string | undefined {
  const scope = (item.payload as { scope?: unknown }).scope
  return typeof scope === 'string' ? scope : undefined
}

export function createHttpSyncTransport(deps?: TransportApi): SyncTransport {
  let cached: TransportApi | null = deps ?? null

  return {
    async send(item, ctx): Promise<SyncOutcome> {
      const key = item.idempotencyKey
      const api: TransportApi = (cached ??= await import('../../lib/api'))
      try {
        switch (item.kind) {
          case 'ticket.comment': {
            const ticketId = ctx.ticketId || item.target.ticketId
            if (!ticketId) return { kind: 'attention', reason: 'Заявка не определена' }
            await api.addTicketComment(
              ticketId,
              String((item.payload as { comment?: string }).comment ?? ''),
              scopeOf(item),
              key,
            )
            return { kind: 'ok' }
          }

          case 'ticket.attachment': {
            const ticketId = ctx.ticketId || item.target.ticketId
            if (!ticketId) return { kind: 'attention', reason: 'Заявка не определена' }
            if (!ctx.blob) return { kind: 'attention', reason: 'Файл не найден на устройстве' }
            await api.uploadTicketAttachment(ticketId, ctx.blob, scopeOf(item), key)
            return { kind: 'ok' }
          }

          case 'ticket.status': {
            const ticketId = ctx.ticketId || item.target.ticketId
            if (!ticketId) return { kind: 'attention', reason: 'Заявка не определена' }
            const payload = item.payload as { status?: ApiModule.TicketStatus; comment?: string }
            if (!payload.status) return { kind: 'attention', reason: 'Статус не указан' }
            await api.updateTicketStatus(
              ticketId,
              { status: payload.status, ...(payload.comment ? { comment: payload.comment } : {}) },
              scopeOf(item),
            )
            return { kind: 'ok' }
          }

          case 'checkpoint.update': {
            const { roundId, checkpointId } = item.target
            if (!roundId || !checkpointId) return { kind: 'attention', reason: 'Чек-поинт не определён' }
            // Ключ не передаётся намеренно: операция сама по себе идемпотентна —
            // это установка значения, где побеждает последнее. См. 113C.
            await api.updateInspectionRunItem(
              roundId,
              checkpointId,
              item.payload as ApiModule.UpdateInspectionRunItemInput,
            )
            return { kind: 'ok' }
          }

          case 'checkpoint.attachment': {
            const { roundId, checkpointId } = item.target
            if (!roundId || !checkpointId) return { kind: 'attention', reason: 'Чек-поинт не определён' }
            if (!ctx.blob) return { kind: 'attention', reason: 'Файл не найден на устройстве' }
            await api.uploadInspectionRunItemAttachment(roundId, checkpointId, ctx.blob, key)
            return { kind: 'ok' }
          }

          case 'ticket.fromRound': {
            const { roundId, checkpointId } = item.target
            if (!roundId || !checkpointId) return { kind: 'attention', reason: 'Чек-поинт не определён' }
            const created = await api.createTicketFromInspectionItem(
              roundId,
              checkpointId,
              item.payload as ApiModule.CreateTicketFromInspectionItemInput,
              key,
            )
            // Настоящий id заявки возвращается координатору: зависимые
            // операции подставят его вместо локального `local:`.
            return { kind: 'ok', serverId: created?.ticket?.id }
          }

          default:
            return { kind: 'attention', reason: `Неизвестная операция: ${item.kind}` }
        }
      } catch (error) {
        return toOutcome(error)
      }
    },
  }
}
