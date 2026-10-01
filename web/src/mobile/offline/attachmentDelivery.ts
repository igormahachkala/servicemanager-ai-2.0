/**
 * Durable delivery вложений заявки и фото чек-поинта (B2-09).
 * Тот же контракт, что у comment: ключ до сети, transport → queue.
 */

import { deliverOnlineFirst } from './durableDelivery.js'
import type { OnlineFirstDeliveryResult } from './durableDelivery.js'
import type { EnqueueInput, EnqueueResult } from './store.js'

export type AttachmentDeliveryResult = OnlineFirstDeliveryResult

export async function deliverTicketAttachment(params: {
  reportedOnline: boolean
  queueInput: Omit<EnqueueInput, 'idempotencyKey'> & { kind: 'ticket.attachment' }
  send: (idempotencyKey: string) => Promise<unknown>
  enqueue: (input: EnqueueInput) => Promise<EnqueueResult>
  onConnectivityFailure?: () => void
}): Promise<AttachmentDeliveryResult> {
  return deliverOnlineFirst(params)
}

export async function deliverCheckpointAttachment(params: {
  reportedOnline: boolean
  queueInput: Omit<EnqueueInput, 'idempotencyKey'> & { kind: 'checkpoint.attachment' }
  send: (idempotencyKey: string) => Promise<unknown>
  enqueue: (input: EnqueueInput) => Promise<EnqueueResult>
  onConnectivityFailure?: () => void
}): Promise<AttachmentDeliveryResult> {
  return deliverOnlineFirst(params)
}
