/**
 * Durable delivery смены статуса заявки и отметки чек-поинта.
 * Тот же online-first контракт, что у comment / attachment (deliverOnlineFirst).
 *
 * Для этих kinds на сервере нет Idempotency-Key (last-write-wins, collapse
 * в очереди). Ключ всё равно выделяется до сети — нужен единый путь
 * «обрыв → та же строка в queue», send ключ может игнорировать.
 */

import { deliverOnlineFirst } from './durableDelivery.js'
import type { OnlineFirstDeliveryResult } from './durableDelivery.js'
import type { EnqueueInput, EnqueueResult } from './store.js'

export type StatusDeliveryResult = OnlineFirstDeliveryResult

export async function deliverTicketStatus(params: {
  reportedOnline: boolean
  queueInput: Omit<EnqueueInput, 'idempotencyKey'> & { kind: 'ticket.status' }
  send: (idempotencyKey: string) => Promise<unknown>
  enqueue: (input: EnqueueInput) => Promise<EnqueueResult>
  onConnectivityFailure?: () => void
}): Promise<StatusDeliveryResult> {
  return deliverOnlineFirst(params)
}

export async function deliverCheckpointUpdate(params: {
  reportedOnline: boolean
  queueInput: Omit<EnqueueInput, 'idempotencyKey'> & { kind: 'checkpoint.update' }
  send: (idempotencyKey: string) => Promise<unknown>
  enqueue: (input: EnqueueInput) => Promise<EnqueueResult>
  onConnectivityFailure?: () => void
}): Promise<StatusDeliveryResult> {
  return deliverOnlineFirst(params)
}
