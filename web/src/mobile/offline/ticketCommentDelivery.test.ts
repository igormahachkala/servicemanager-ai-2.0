import { describe, expect, it, vi } from 'vitest'

import { ApiRequestError } from '../../lib/api'
import * as api from '../../lib/api'
import { reportApiReachability, subscribeApiReachability } from '../../lib/apiReachability'
import { MemoryDriver } from './driver'
import { OfflineStore } from './store'
import { SyncCoordinator } from './sync'
import { createHttpSyncTransport } from './transport'
import { deliverTicketComment } from './ticketCommentDelivery'

function setup() {
  const driver = new MemoryDriver()
  const store = new OfflineStore(driver, 'company-1:user-1')
  const enqueue = store.enqueue.bind(store)
  const input = {
    kind: 'ticket.comment' as const,
    target: { ticketId: 'ticket-1' },
    payload: { comment: 'Тест', scope: { companyId: 'company-1' } },
  }
  return { driver, store, enqueue, input }
}

describe('physical mobile comment connectivity fallback', () => {
  it('API transport failure marks reachability false while an HTTP response marks it true', async () => {
    const observed: boolean[] = []
    const unsubscribe = subscribeApiReachability((reachable) => observed.push(reachable))
    reportApiReachability(true)
    observed.length = 0

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Load failed')))
    await expect(api.addTicketComment('ticket-1', 'Тест')).rejects.toBeInstanceOf(TypeError)
    expect(observed).toEqual([false])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: 'Forbidden' }),
    }))
    await expect(api.addTicketComment('ticket-1', 'Тест')).rejects.toMatchObject({ status: 403 })
    expect(observed).toEqual([false, true])

    unsubscribe()
    vi.unstubAllGlobals()
  })

  it('reported online + fetch TypeError persists the comment instead of losing it', async () => {
    const { store, enqueue, input } = setup()
    const send = vi.fn().mockRejectedValue(new TypeError('Load failed'))
    const connectivityFailure = vi.fn()

    const result = await deliverTicketComment({
      reportedOnline: true,
      queueInput: input,
      send,
      enqueue,
      onConnectivityFailure: connectivityFailure,
    })

    expect(result.kind).toBe('queued')
    expect(connectivityFailure).toHaveBeenCalledOnce()
    expect((await store.listQueue())[0].payload.comment).toBe('Тест')
  })

  it('reported offline queues directly without attempting the network', async () => {
    const { store, enqueue, input } = setup()
    const send = vi.fn()

    const result = await deliverTicketComment({ reportedOnline: false, queueInput: input, send, enqueue })

    expect(result.kind).toBe('queued')
    expect(send).not.toHaveBeenCalled()
    expect(await store.pendingCount()).toBe(1)
  })

  it.each([400, 401, 403, 409])('HTTP %s remains an application error and is not queued', async (status) => {
    const { store, enqueue, input } = setup()
    const error = new ApiRequestError(`HTTP ${status}`, status)

    await expect(deliverTicketComment({
      reportedOnline: true,
      queueInput: input,
      send: vi.fn().mockRejectedValue(error),
      enqueue,
    })).rejects.toBe(error)

    expect(await store.pendingCount()).toBe(0)
  })

  it('replay reuses the key reserved for the uncertain first attempt', async () => {
    const { store, enqueue, input } = setup()
    let attemptedKey = ''
    await deliverTicketComment({
      reportedOnline: true,
      queueInput: input,
      send: vi.fn(async (key: string) => {
        attemptedKey = key
        throw new TypeError('Failed to fetch')
      }),
      enqueue,
    })

    const sentKeys: string[] = []
    const transport = createHttpSyncTransport({
      addTicketComment: vi.fn(async (_id, _text, _scope, options) => {
        sentKeys.push(typeof options === 'string' ? options : options?.idempotencyKey || '')
        return { ok: true }
      }),
    } as never)
    const queued = (await store.listQueue())[0]
    await transport.send(queued, { blob: null })
    await transport.send(queued, { blob: null })

    expect(sentKeys).toEqual([attemptedKey, attemptedKey])
  })

  it('offline reply preserves replyToId with the stable operation identity', async () => {
    const { store, enqueue, input } = setup()
    const result = await deliverTicketComment({
      reportedOnline: false,
      queueInput: { ...input, payload: { ...input.payload, replyToId: 'comment-42' } },
      send: vi.fn(),
      enqueue,
    })
    expect(result.kind).toBe('queued')

    const queued = (await store.listQueue())[0]
    const calls: Array<{ key?: string; replyToId?: string }> = []
    const coordinator = new SyncCoordinator(store, createHttpSyncTransport({
      addTicketComment: vi.fn(async (_id, _text, _scope, options) => {
        calls.push(typeof options === 'string' ? { key: options } : {
          key: options?.idempotencyKey,
          replyToId: options?.replyToId,
        })
        return { ok: true }
      }),
    } as never), { useWebLocks: false })
    await coordinator.run()

    expect(calls).toEqual([{ key: queued.idempotencyKey, replyToId: 'comment-42' }])
  })

  it('queued comment survives a cold store reconstruction', async () => {
    const { driver, store, enqueue, input } = setup()
    await deliverTicketComment({ reportedOnline: false, queueInput: input, send: vi.fn(), enqueue })
    const before = (await store.listQueue())[0]

    const restored = new OfflineStore(driver, 'company-1:user-1')
    const after = (await restored.listQueue())[0]

    expect(after).toEqual(before)
    expect(after.payload.comment).toBe('Тест')
  })
})
