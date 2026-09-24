import { ConflictException } from '@nestjs/common'
import { IdempotencyRecordStatus, Prisma } from '@prisma/client'

import { IdempotencyService } from './idempotency.service'

/**
 * SMA-OFFLINE-IDEMPOTENCY-113B.
 *
 * The scenario every test here circles is the one that breaks an offline queue: the server
 * committed, the response was lost, the client retried. A passing suite means the retry does
 * not write a second time.
 */

const SCOPE = { companyId: 'co-1', userId: 'u-1', operationType: 'ticket_comment', key: 'k-1' }

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: '5.22.0',
  })
}

/** Fake prisma backed by a Map keyed the same way the unique index is. */
function makePrisma(seed: any[] = []) {
  const rows = new Map<string, any>()
  const k = (s: any) => `${s.companyId}|${s.userId}|${s.operationType}|${s.key}`
  for (const row of seed) rows.set(k(row), { updatedAt: new Date(), ...row })

  return {
    rows,
    idempotencyRecord: {
      create: jest.fn(async ({ data }: any) => {
        if (rows.has(k(data))) throw p2002()
        const row = { id: 'rec-' + rows.size, updatedAt: new Date(), ...data }
        rows.set(k(data), row)
        return row
      }),
      findUnique: jest.fn(async ({ where }: any) => rows.get(k(where.companyId_userId_operationType_key)) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const key = k(where.companyId_userId_operationType_key)
        const row = { ...rows.get(key), ...data, updatedAt: new Date() }
        rows.set(key, row)
        return row
      }),
      delete: jest.fn(async ({ where }: any) => {
        rows.delete(k(where.companyId_userId_operationType_key))
        return {}
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  } as any
}

const handlers = (execute: jest.Mock, replay: jest.Mock, discardOrphan?: jest.Mock) => ({
  execute,
  replay,
  ...(discardOrphan ? { discardOrphan } : {}),
})

describe('113B idempotency', () => {
  beforeEach(() => jest.clearAllMocks())

  it('first request executes the domain write once', async () => {
    const prisma = makePrisma()
    const svc = new IdempotencyService(prisma)
    const execute = jest.fn(async () => ({ result: { ok: true }, entityType: 'DomainEvent', entityId: 'e1' }))
    const replay = jest.fn()

    const out = await svc.run(SCOPE, 'fp1', handlers(execute, replay))

    expect(out.executed).toBe(true)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(replay).not.toHaveBeenCalled()
  })

  it('an identical retry after a lost response replays instead of writing again', async () => {
    const prisma = makePrisma()
    const svc = new IdempotencyService(prisma)
    const execute = jest.fn(async () => ({ result: { id: 'a1' }, entityType: 'TicketAttachment', entityId: 'a1' }))
    const replay = jest.fn(async () => ({ id: 'a1' }))

    await svc.run(SCOPE, 'fp1', handlers(execute, replay))
    const second = await svc.run(SCOPE, 'fp1', handlers(execute, replay))

    // The whole point: one domain write, two client calls, same answer.
    expect(execute).toHaveBeenCalledTimes(1)
    expect(replay).toHaveBeenCalledTimes(1)
    expect(second.executed).toBe(false)
    expect(second.result).toEqual({ id: 'a1' })
  })

  it('the same key with a different payload is refused, not guessed at', async () => {
    const prisma = makePrisma()
    const svc = new IdempotencyService(prisma)
    const execute = jest.fn(async () => ({ result: {}, entityType: 'X', entityId: 'x1' }))

    await svc.run(SCOPE, 'fp1', handlers(execute, jest.fn(async () => ({}))))

    await expect(svc.run(SCOPE, 'fp-DIFFERENT', handlers(execute, jest.fn()))).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('another user reusing the same key gets their own execution, not the first result', async () => {
    const prisma = makePrisma()
    const svc = new IdempotencyService(prisma)
    const execute = jest.fn(async () => ({ result: { who: 'x' }, entityType: 'X', entityId: 'x1' }))

    await svc.run(SCOPE, 'fp1', handlers(execute, jest.fn()))
    const other = await svc.run({ ...SCOPE, userId: 'u-2' }, 'fp1', handlers(execute, jest.fn()))

    // Guessing a colleague's key must not surface their result.
    expect(other.executed).toBe(true)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('another company reusing the same key is likewise isolated', async () => {
    const prisma = makePrisma()
    const svc = new IdempotencyService(prisma)
    const execute = jest.fn(async () => ({ result: {}, entityType: 'X', entityId: 'x1' }))

    await svc.run(SCOPE, 'fp1', handlers(execute, jest.fn()))
    const other = await svc.run({ ...SCOPE, companyId: 'co-2' }, 'fp1', handlers(execute, jest.fn()))

    expect(other.executed).toBe(true)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('a concurrent duplicate is told the operation is in progress rather than writing twice', async () => {
    const prisma = makePrisma([
      { ...SCOPE, fingerprint: 'fp1', status: IdempotencyRecordStatus.IN_PROGRESS, updatedAt: new Date() },
    ])
    const svc = new IdempotencyService(prisma)
    const execute = jest.fn()

    await expect(svc.run(SCOPE, 'fp1', handlers(execute, jest.fn()))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'IDEMPOTENCY_IN_PROGRESS' }),
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('a stale in-progress record is taken over and its orphaned file discarded', async () => {
    // The crash case: the binary was written, the row never committed.
    const prisma = makePrisma([
      {
        ...SCOPE,
        fingerprint: 'fp1',
        status: IdempotencyRecordStatus.IN_PROGRESS,
        storageKey: 'orphan.jpg',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    ])
    const svc = new IdempotencyService(prisma)
    const execute = jest.fn(async () => ({ result: { id: 'a2' }, entityType: 'TicketAttachment', entityId: 'a2' }))
    const discardOrphan = jest.fn(async () => undefined)

    const out = await svc.run(SCOPE, 'fp1', handlers(execute, jest.fn(), discardOrphan))

    expect(discardOrphan).toHaveBeenCalledWith('orphan.jpg')
    expect(out.executed).toBe(true)
  })

  it('a failed domain write releases the key so the client may retry it', async () => {
    const prisma = makePrisma()
    const svc = new IdempotencyService(prisma)
    const boom = jest.fn(async () => { throw new Error('db down') })

    await expect(svc.run(SCOPE, 'fp1', handlers(boom as any, jest.fn()))).rejects.toThrow('db down')
    expect(prisma.idempotencyRecord.delete).toHaveBeenCalled()

    const ok = jest.fn(async () => ({ result: { ok: true }, entityType: 'X', entityId: 'x1' }))
    const retry = await svc.run(SCOPE, 'fp1', handlers(ok, jest.fn()))
    expect(retry.executed).toBe(true)
  })

  it('reports rather than silently recreating when the earlier result was deleted', async () => {
    const prisma = makePrisma()
    const svc = new IdempotencyService(prisma)
    const execute = jest.fn(async () => ({ result: { id: 'a1' }, entityType: 'X', entityId: 'a1' }))

    await svc.run(SCOPE, 'fp1', handlers(execute, jest.fn()))
    await expect(
      svc.run(SCOPE, 'fp1', handlers(execute, jest.fn(async () => null))),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'IDEMPOTENCY_RESULT_GONE' }) })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('fingerprints are order-independent but value-sensitive', () => {
    const a = IdempotencyService.fingerprint({ ticketId: 't1', comment: 'привет' })
    const b = IdempotencyService.fingerprint({ comment: 'привет', ticketId: 't1' })
    const c = IdempotencyService.fingerprint({ ticketId: 't1', comment: 'другое' })

    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it('normalizes keys and treats blank as "no idempotency requested"', () => {
    expect(IdempotencyService.normalizeKey('  k  ')).toBe('k')
    expect(IdempotencyService.normalizeKey('')).toBeNull()
    expect(IdempotencyService.normalizeKey(undefined)).toBeNull()
    expect(() => IdempotencyService.normalizeKey('x'.repeat(201))).toThrow()
  })
})
