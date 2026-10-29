import type { BoardResponse } from './api'
import type { ChatMessage } from './ticketChat'

/**
 * Индикатор 💬 непрочитанного чата в списках заявок.
 *
 * Сервер отдаёт hasUnreadChat на карточке доски. Клиент, показав чат,
 * отмечает его прочитанным до времени последнего сообщения в ленте —
 * не «сейчас»: сообщение, пришедшее после загрузки ленты, остаётся
 * непрочитанным, пока его не покажут.
 */

/** Списки, где рисуется 💬. Все читают api.board, ключи — по месту запроса. */
export const CHAT_UNREAD_LIST_QUERY_KEYS: ReadonlyArray<readonly [string]> = [
  ['board'],
  ['archive-board'],
  ['mobile-home-board'],
  ['mobile-home-completed-board'],
  ['mobile-my-board'],
  ['mobile-chats-board'],
]

/** Время самого позднего сообщения ленты в ISO; null — лента пуста. */
export function latestChatMessageAt(messages: ReadonlyArray<Pick<ChatMessage, 'at'>>): string | null {
  let latestMs = Number.NEGATIVE_INFINITY
  let latest: string | null = null
  for (const message of messages) {
    const ms = Date.parse(message.at)
    if (Number.isNaN(ms) || ms <= latestMs) continue
    latestMs = ms
    latest = message.at
  }
  return latest
}

/** Отметку шлём, только когда в ленте появилось что-то новее уже отправленного. */
export function shouldMarkChatRead(input: { latestAt: string | null; lastMarkedAt: string | null }): boolean {
  if (!input.latestAt) return false
  const latestMs = Date.parse(input.latestAt)
  if (Number.isNaN(latestMs)) return false
  if (!input.lastMarkedAt) return true
  const lastMs = Date.parse(input.lastMarkedAt)
  return Number.isNaN(lastMs) || latestMs > lastMs
}

function isBoardResponse(value: unknown): value is BoardResponse {
  const columns = (value as { columns?: unknown } | null)?.columns
  return Array.isArray(columns) && columns.every((c) => Array.isArray((c as { cards?: unknown } | null)?.cards))
}

/**
 * Гасит 💬 у заявки в закэшированном ответе доски, пока список перезапрашивается.
 * Чужую форму данных и ответ без изменений возвращает тем же объектом.
 */
export function clearUnreadChatInBoard<T>(data: T, ticketId: string): T {
  if (!isBoardResponse(data)) return data
  let changed = false
  const columns = data.columns.map((column) => {
    if (!column.cards.some((card) => card.id === ticketId && card.hasUnreadChat)) return column
    changed = true
    return {
      ...column,
      cards: column.cards.map((card) => (card.id === ticketId ? { ...card, hasUnreadChat: false } : card)),
    }
  })
  return changed ? ({ ...data, columns } as T) : data
}
