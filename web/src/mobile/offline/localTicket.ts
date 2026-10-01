/**
 * Цепочка dependsOnId для local: заявок из обхода.
 *
 * Пока ticket.fromRound не synced, комментарий и фото адресуют тот же
 * local: ticketId и ссылаются на родителя через dependsOnId. Координатор
 * ждёт synced у родителя и подставляет серверный id из ticketIdMap.
 */

import { isLocalId } from './store.js'
import type { OfflineQueueItem, OfflineQueueStatus } from './types.js'

/** Статусы родителя, с которых ещё можно строить зависимость. */
const PARENT_OK_STATUSES: ReadonlySet<OfflineQueueStatus> = new Set([
  'pending',
  'syncing',
  'synced',
])

/**
 * Id строки `ticket.fromRound` для данного local: ticketId.
 * failed/attention не берём: зависеть от них бессмысленно.
 */
export function findParentFromRoundQueueId(
  localTicketId: string,
  queue: OfflineQueueItem[],
): string | undefined {
  if (!isLocalId(localTicketId)) return undefined
  const parent = queue.find(
    (item) =>
      item.kind === 'ticket.fromRound' &&
      item.target.ticketId === localTicketId &&
      PARENT_OK_STATUSES.has(item.status),
  )
  return parent?.id
}

/** Минимальная карточка local: заявки до появления серверного id. */
export type LocalTicketStub = {
  id: string
  status: 'NEW'
  urgency: 'URGENT' | 'NOT_URGENT'
  priority: 'NORMAL' | 'URGENT'
  problemText: string
  title?: string
  description?: string
  createdAt: string
  updatedAt: string
  requesterName: null
  requesterPhone: null
  address: null
  pointName: null
  slaMinutes: null
  slaDueAt: null
  slaBreachedAt: null
  assignedTechnicianId: null
  assignedTechnician: null
  problemCategory: { id: string; name: string; instructions: null }
  companyId?: string | null
}

/**
 * Собирает карточку из payload родительской строки очереди.
 * Без родителя в очереди открывать local: экран не из чего.
 */
export function buildLocalTicketFromQueue(
  localTicketId: string,
  queue: OfflineQueueItem[],
): LocalTicketStub | null {
  if (!isLocalId(localTicketId)) return null
  const parent = queue.find(
    (item) =>
      item.kind === 'ticket.fromRound' &&
      item.target.ticketId === localTicketId &&
      PARENT_OK_STATUSES.has(item.status),
  )
  if (!parent) return null

  const payload = parent.payload as {
    categoryId?: string
    title?: string
    description?: string
    urgency?: 'URGENT' | 'NOT_URGENT'
  }
  const urgency = payload.urgency === 'URGENT' ? 'URGENT' : 'NOT_URGENT'
  const problemText =
    (payload.title || '').trim() ||
    (payload.description || '').trim() ||
    'Заявка из обхода (на устройстве)'

  return {
    id: localTicketId,
    status: 'NEW',
    urgency,
    priority: urgency === 'URGENT' ? 'URGENT' : 'NORMAL',
    problemText,
    title: payload.title,
    description: payload.description,
    createdAt: parent.createdAt,
    updatedAt: parent.updatedAt,
    requesterName: null,
    requesterPhone: null,
    address: null,
    pointName: null,
    slaMinutes: null,
    slaDueAt: null,
    slaBreachedAt: null,
    assignedTechnicianId: null,
    assignedTechnician: null,
    problemCategory: {
      id: (payload.categoryId || '').trim() || 'local',
      name: 'Заявка на устройстве',
      instructions: null,
    },
  }
}
