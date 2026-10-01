/**
 * Durable delivery комментария заявки (B2 comment path).
 * Общая логика — в durableDelivery.ts.
 */

import { deliverOnlineFirst, isRetrySafeConnectivityFailure } from './durableDelivery.js'
import type { EnqueueInput, EnqueueResult } from './store.js'
import type { OnlineFirstDeliveryResult } from './durableDelivery.js'

export type TicketCommentDeliveryResult = OnlineFirstDeliveryResult

export { isRetrySafeConnectivityFailure }

export async function deliverTicketComment(params: {
  reportedOnline: boolean
  queueInput: Omit<EnqueueInput, 'idempotencyKey'>
  send: (idempotencyKey: string) => Promise<unknown>
  enqueue: (input: EnqueueInput) => Promise<EnqueueResult>
  onConnectivityFailure?: () => void
}): Promise<TicketCommentDeliveryResult> {
  return deliverOnlineFirst(params)
}
