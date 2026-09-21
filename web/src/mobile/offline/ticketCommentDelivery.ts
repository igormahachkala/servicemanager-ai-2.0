import { ApiRequestError, ApiTimeoutError } from '../../lib/api.js'
import {
  createOfflineIdempotencyKey,
  type EnqueueInput,
  type EnqueueResult,
} from './store.js'

export type TicketCommentDeliveryResult =
  | { kind: 'sent' }
  | { kind: 'queued'; item: Extract<EnqueueResult, { ok: true }>['item'] }
  | { kind: 'queue-failed'; message: string }

export function isRetrySafeConnectivityFailure(error: unknown): boolean {
  // A real HTTP response is application truth, including 4xx and 5xx. It
  // must not be converted into an offline operation by the UI.
  if (error instanceof ApiRequestError) return false
  if (error instanceof ApiTimeoutError) return true

  const name = String((error as { name?: unknown } | null)?.name || '').toLowerCase()
  const message = String((error as { message?: unknown } | null)?.message || error || '').toLowerCase()

  // fetch() rejects with TypeError for network failures in Chromium/Safari.
  if (error instanceof TypeError) return true
  if (name === 'networkerror' || name === 'aborterror') return true
  return (
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  )
}
export async function deliverTicketComment(params: {
  reportedOnline: boolean
  queueInput: Omit<EnqueueInput, 'idempotencyKey'>
  send: (idempotencyKey: string) => Promise<unknown>
  enqueue: (input: EnqueueInput) => Promise<EnqueueResult>
  onConnectivityFailure?: () => void
}): Promise<TicketCommentDeliveryResult> {
  const idempotencyKey = createOfflineIdempotencyKey('ticket.comment')

  const persist = async (): Promise<TicketCommentDeliveryResult> => {
    const queued = await params.enqueue({ ...params.queueInput, idempotencyKey })
    return queued.ok
      ? { kind: 'queued', item: queued.item }
      : { kind: 'queue-failed', message: queued.message }
  }

  if (!params.reportedOnline) return persist()

  try {
    await params.send(idempotencyKey)
    return { kind: 'sent' }
  } catch (error) {
    if (!isRetrySafeConnectivityFailure(error)) throw error
    params.onConnectivityFailure?.()
    return persist()
  }
}
