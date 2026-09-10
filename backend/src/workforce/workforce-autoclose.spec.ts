import { UserRole, WorkLogStatus, WorkShiftStatus } from '@prisma/client'

import { WorkforceService } from './workforce.service'

/**
 * SMA-SHIFT-AUTOCLOSE-CORRECTNESS-106A.
 *
 * Drives autoCloseDueShifts through a fake prisma so the exact values written to WorkShift,
 * WorkLog and DomainEvent are observable. The defect being fixed is a written timestamp, so
 * asserting on the write is the only thing that proves it.
 */

const MSK = 'Europe/Moscow'

type Row = { id: string; openedAt: Date; company: { timezone: string | null; shiftAutoCloseTime: string } }

function makePrisma(openShifts: Row[], runningLogs: any[] = []) {
  const writes = { shift: [] as any[], logs: [] as any[], events: [] as any[] }
  let claimCount = 1

  const tx = {
    workShift: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        writes.shift.push({ where, data })
        return { count: claimCount }
      }),
      findUnique: jest.fn(async ({ where }: any) => ({
        id: where.id,
        companyId: 'provider-1',
        workLogs: runningLogs,
      })),
    },
    workLog: { update: jest.fn(async (args: any) => { writes.logs.push(args); return args }) },
    domainEvent: { create: jest.fn(async (args: any) => { writes.events.push(args.data); return args }) },
  }

  const prisma = {
    workShift: { findMany: jest.fn(async () => openShifts) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  } as any

  return { prisma, writes, tx, setClaimCount: (n: number) => { claimCount = n } }
}

function service(prisma: any) {
  return new WorkforceService(prisma, {} as any)
}

describe('106A auto-close writes the configured boundary, not the sweeper instant', () => {
  beforeEach(() => jest.clearAllMocks())

  it('same-day: closedAt is the configured close time even when the sweeper is late', async () => {
    const { prisma, writes } = makePrisma([
      {
        id: 'shift-1',
        openedAt: new Date('2026-09-09T05:00:00.000Z'), // 08:00 MSK
        company: { timezone: MSK, shiftAutoCloseTime: '19:00' },
      },
    ])

    const closed = await service(prisma).autoCloseDueShifts(new Date('2026-09-09T16:00:43.000Z'))

    expect(closed).toBe(1)
    const data = writes.shift[0].data
    expect(data.status).toBe(WorkShiftStatus.AUTO_CLOSED)
    expect(data.closedAt.toISOString()).toBe('2026-09-09T16:00:00.000Z') // 19:00 MSK exactly
    expect(data.closedAt.toISOString()).not.toBe('2026-09-09T16:00:43.000Z')
  })

  it('a sweeper 40 minutes late writes the same closedAt as one that is on time', async () => {
    const row = (): Row => ({
      id: 'shift-1',
      openedAt: new Date('2026-09-09T05:00:00.000Z'),
      company: { timezone: MSK, shiftAutoCloseTime: '19:00' },
    })
    const a = makePrisma([row()])
    const b = makePrisma([row()])

    await service(a.prisma).autoCloseDueShifts(new Date('2026-09-09T16:00:02.000Z'))
    await service(b.prisma).autoCloseDueShifts(new Date('2026-09-09T16:40:00.000Z'))

    expect(a.writes.shift[0].data.closedAt.toISOString()).toBe(b.writes.shift[0].data.closedAt.toISOString())
  })

  it('UTC company resolves the boundary in UTC', async () => {
    const { prisma, writes } = makePrisma([
      {
        id: 'shift-1',
        openedAt: new Date('2026-09-09T06:00:00.000Z'),
        company: { timezone: 'UTC', shiftAutoCloseTime: '19:00' },
      },
    ])

    await service(prisma).autoCloseDueShifts(new Date('2026-09-09T19:00:31.000Z'))

    expect(writes.shift[0].data.closedAt.toISOString()).toBe('2026-09-09T19:00:00.000Z')
  })

  it('previous-day rule: closedAt is the close time of the day the shift was opened', async () => {
    const { prisma, writes } = makePrisma([
      {
        id: 'shift-1',
        openedAt: new Date('2026-09-08T05:00:00.000Z'), // 08:00 MSK, 8 Sep
        company: { timezone: MSK, shiftAutoCloseTime: '19:00' },
      },
    ])

    await service(prisma).autoCloseDueShifts(new Date('2026-09-09T06:00:00.000Z')) // 09:00 MSK, 9 Sep

    expect(writes.shift[0].data.closedAt.toISOString()).toBe('2026-09-08T16:00:00.000Z')
  })

  it('keeps pre-106A behaviour when no boundary can be justified', async () => {
    // Opened 20:00 MSK against a 19:00 boundary; the previous-day rule fires at local midnight.
    // 106A must not invent a night-shift rule, so `now` is preserved and flagged for audit.
    const now = new Date('2026-09-08T21:00:30.000Z')
    const { prisma, writes } = makePrisma([
      {
        id: 'shift-1',
        openedAt: new Date('2026-09-08T17:00:00.000Z'),
        company: { timezone: MSK, shiftAutoCloseTime: '19:00' },
      },
    ])

    await service(prisma).autoCloseDueShifts(now)

    expect(writes.shift[0].data.closedAt.toISOString()).toBe(now.toISOString())
    const event = writes.events.find((e) => e.type === 'workforce.shift_auto_closed')
    expect(event.payload.boundaryResolved).toBe(false)
  })

  it('does not touch a shift that is no longer OPEN, and is idempotent on a second pass', async () => {
    const { prisma, writes, setClaimCount } = makePrisma([
      {
        id: 'shift-1',
        openedAt: new Date('2026-09-09T05:00:00.000Z'),
        company: { timezone: MSK, shiftAutoCloseTime: '19:00' },
      },
    ])
    setClaimCount(0) // the OPEN-guarded claim matched nothing: already closed by someone else

    const closed = await service(prisma).autoCloseDueShifts(new Date('2026-09-09T16:00:43.000Z'))

    expect(closed).toBe(0)
    expect(writes.shift[0].where).toMatchObject({ id: 'shift-1', status: WorkShiftStatus.OPEN })
    expect(writes.logs).toHaveLength(0)
    expect(writes.events).toHaveLength(0)
  })

  it('preserves closeReason and the auto-close DomainEvent', async () => {
    const { prisma, writes } = makePrisma([
      {
        id: 'shift-1',
        openedAt: new Date('2026-09-09T05:00:00.000Z'),
        company: { timezone: MSK, shiftAutoCloseTime: '19:00' },
      },
    ])

    await service(prisma).autoCloseDueShifts(new Date('2026-09-09T16:00:43.000Z'))

    expect(writes.shift[0].data.closeReason).toBe('AUTO_CLOSE_19:00')
    const event = writes.events.find((e) => e.type === 'workforce.shift_auto_closed')
    expect(event).toBeDefined()
    expect(event.entityType).toBe('WorkShift')
    expect(event.actorUserId).toBeNull()
    expect(event.payload.reason).toBe('AUTO_CLOSE_19:00')
    expect(event.payload.closedAt).toBe('2026-09-09T16:00:00.000Z')
    // The sweeper's own clock stays visible for audit without moving closedAt.
    expect(event.payload.sweptAt).toBe('2026-09-09T16:00:43.000Z')
    expect(event.payload.boundaryResolved).toBe(true)
  })

  it('ends a running WorkLog at the same corrected boundary as its shift', async () => {
    const { prisma, writes } = makePrisma(
      [
        {
          id: 'shift-1',
          openedAt: new Date('2026-09-09T05:00:00.000Z'),
          company: { timezone: MSK, shiftAutoCloseTime: '19:00' },
        },
      ],
      [
        {
          id: 'log-1',
          ticketId: 'ticket-1',
          startedAt: new Date('2026-09-09T14:00:00.000Z'), // 17:00 MSK
          status: WorkLogStatus.RUNNING,
          ticket: { companyId: 'client-1' },
        },
      ],
    )

    await service(prisma).autoCloseDueShifts(new Date('2026-09-09T16:00:43.000Z'))

    const log = writes.logs[0]
    expect(log.data.status).toBe(WorkLogStatus.AUTO_STOPPED)
    expect(log.data.endedAt.toISOString()).toBe('2026-09-09T16:00:00.000Z')
    expect(log.data.endedAt.toISOString()).toBe(writes.shift[0].data.closedAt.toISOString())
    expect(log.data.durationMinutes).toBe(120) // 17:00 → 19:00 MSK
  })

  it('never gives a WorkLog started after the boundary a negative duration', async () => {
    // The shift was still OPEN between the boundary and this sweeper pass, so starting work
    // then was legal. Pulling the end back to the boundary must not invert the interval.
    const { prisma, writes } = makePrisma(
      [
        {
          id: 'shift-1',
          openedAt: new Date('2026-09-09T05:00:00.000Z'),
          company: { timezone: MSK, shiftAutoCloseTime: '19:00' },
        },
      ],
      [
        {
          id: 'log-late',
          ticketId: 'ticket-1',
          startedAt: new Date('2026-09-09T16:00:20.000Z'), // 20 s after the boundary
          status: WorkLogStatus.RUNNING,
          ticket: { companyId: 'client-1' },
        },
      ],
    )

    await service(prisma).autoCloseDueShifts(new Date('2026-09-09T16:00:43.000Z'))

    const log = writes.logs[0]
    expect(log.data.endedAt.toISOString()).toBe('2026-09-09T16:00:20.000Z')
    expect(log.data.durationMinutes).toBeGreaterThan(0)
  })

  it('leaves a manual close on the current time — 106A changes auto-close only', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'tech-1' }) },
      workShift: {
        // getMyState runs after the close and reads the shift back with its logs included.
        findFirst: jest.fn().mockResolvedValue({ id: 'shift-1', workLogs: [] }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'provider-1' }) },
      $transaction: jest.fn(async (fn: any) =>
        fn({
          workShift: {
            updateMany: jest.fn(async ({ data }: any) => {
              captured = data
              return { count: 1 }
            }),
            findUnique: jest.fn(async () => ({ id: 'shift-1', companyId: 'provider-1', workLogs: [] })),
          },
          workLog: { update: jest.fn() },
          domainEvent: { create: jest.fn() },
        }),
      ),
    } as any
    let captured: any
    const before = Date.now()

    await new WorkforceService(prisma, {} as any).closeShift(
      { id: 'tech-1', companyId: 'provider-1', role: UserRole.TECHNICIAN },
      'готово',
    )

    expect(captured.status).toBe(WorkShiftStatus.CLOSED)
    expect(captured.closeReason).toBe('готово')
    expect(captured.closedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(captured.closedAt.getTime()).toBeLessThanOrEqual(Date.now())
  })
})
