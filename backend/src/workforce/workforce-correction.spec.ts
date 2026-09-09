import { BadRequestException, NotFoundException } from '@nestjs/common'
import { UserRole, WorkShiftStatus } from '@prisma/client'

import { PERMISSIONS } from '../common/permissions.constants'
import { WorkforceController } from './workforce.controller'
import { WorkforceService } from './workforce.service'

/** SMA-SHIFT-LABOR-LEDGER-INTEGRITY-106B — corrections are auditable and never rewrite history. */

const manager = { id: 'mgr-1', companyId: 'provider-1', role: UserRole.ADMIN }
const OPENED = new Date('2026-09-01T05:00:00.000Z')
const CLOSED = new Date('2026-09-01T16:00:00.000Z')

function makePrisma(shift: any) {
  const created: any[] = []
  const events: any[] = []
  const shiftUpdates: any[] = []

  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue({ id: manager.id }) },
    company: { findUnique: jest.fn().mockResolvedValue({ id: manager.companyId }) },
    workShift: {
      // Mirrors the real tenant filter: a shift of another company simply is not found.
      findFirst: jest.fn(async ({ where }: any) =>
        shift && shift.id === where.id && shift.companyId === where.companyId
          ? { ...shift, corrections: shift.corrections ?? [] }
          : null,
      ),
      update: jest.fn(async (args: any) => {
        shiftUpdates.push(args)
        return args
      }),
    },
    workShiftCorrection: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: 'corr-1', createdAt: new Date('2026-09-01T18:00:00.000Z'), ...data }
        created.push(row)
        return row
      }),
    },
    domainEvent: { create: jest.fn(async ({ data }: any) => { events.push(data); return data }) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  } as any

  return { prisma, created, events, shiftUpdates }
}

const service = (prisma: any) => new WorkforceService(prisma, {} as any)

const closedShift = (over: any = {}) => ({
  id: 'shift-1',
  companyId: manager.companyId,
  status: WorkShiftStatus.CLOSED,
  openedAt: OPENED,
  closedAt: CLOSED,
  user: { id: 'tech-1' },
  ...over,
})

describe('106B shift corrections', () => {
  beforeEach(() => jest.clearAllMocks())

  it('records a correction without touching the original shift row', async () => {
    const { prisma, created, shiftUpdates } = makePrisma(closedShift())

    await service(prisma).createShiftCorrection(manager, 'shift-1', {
      correctedClosedAt: '2026-09-01T15:07:00.000Z',
      reason: 'Сотрудник забыл закрыть смену, фактически до 18:07',
    } as any)

    expect(created).toHaveLength(1)
    // The whole point: openedAt/closedAt/status/closeReason are never written.
    expect(shiftUpdates).toHaveLength(0)
    expect(prisma.workShift.update).not.toHaveBeenCalled()
  })

  it('records the actor on the correction — no anonymous correction', async () => {
    const { prisma, created } = makePrisma(closedShift())

    await service(prisma).createShiftCorrection(manager, 'shift-1', {
      correctedClosedAt: '2026-09-01T15:07:00.000Z',
      reason: 'фактическое время',
    } as any)

    expect(created[0].correctedByUserId).toBe(manager.id)
    expect(created[0].reason).toBe('фактическое время')
  })

  it('emits an auditable DomainEvent carrying both recorded and corrected values', async () => {
    const { prisma, events } = makePrisma(closedShift())

    await service(prisma).createShiftCorrection(manager, 'shift-1', {
      correctedClosedAt: '2026-09-01T15:07:00.000Z',
      reason: 'фактическое время',
    } as any)

    const event = events.find((e) => e.type === 'workforce.shift_corrected')
    expect(event).toBeDefined()
    expect(event.actorUserId).toBe(manager.id)
    expect(event.entityType).toBe('WorkShift')
    expect(event.payload.recordedClosedAt).toBe(CLOSED.toISOString())
    expect(event.payload.correctedClosedAt).toBe('2026-09-01T15:07:00.000Z')
  })

  it.each([
    ['blank', '   '],
    ['missing', undefined],
  ])('refuses a correction with a %s reason', async (_label, reason) => {
    const { prisma, created } = makePrisma(closedShift())

    await expect(
      service(prisma).createShiftCorrection(manager, 'shift-1', {
        correctedClosedAt: '2026-09-01T15:07:00.000Z',
        reason,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(created).toHaveLength(0)
  })

  it('refuses a correction that changes nothing', async () => {
    const { prisma } = makePrisma(closedShift())

    await expect(
      service(prisma).createShiftCorrection(manager, 'shift-1', { reason: 'просто так' } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('enforces tenant isolation — another company’s shift is not found', async () => {
    const { prisma, created } = makePrisma(closedShift({ companyId: 'other-company' }))

    await expect(
      service(prisma).createShiftCorrection(manager, 'shift-1', {
        correctedClosedAt: '2026-09-01T15:07:00.000Z',
        reason: 'чужая смена',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(created).toHaveLength(0)
  })

  it('refuses to close an OPEN shift through a correction', async () => {
    // Ending a running shift is an operational act with its own rules; a correction records
    // what already happened and must not become a second way to do it.
    const { prisma } = makePrisma(closedShift({ status: WorkShiftStatus.OPEN, closedAt: null }))

    await expect(
      service(prisma).createShiftCorrection(manager, 'shift-1', {
        correctedClosedAt: '2026-09-01T15:07:00.000Z',
        reason: 'закрыть',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('refuses a correction that ends the shift before it started', async () => {
    const { prisma } = makePrisma(closedShift())

    await expect(
      service(prisma).createShiftCorrection(manager, 'shift-1', {
        correctedClosedAt: '2026-09-01T04:00:00.000Z',
        reason: 'до начала',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('refuses a correction in the future', async () => {
    const { prisma } = makePrisma(closedShift())

    await expect(
      service(prisma).createShiftCorrection(manager, 'shift-1', {
        correctedClosedAt: new Date(Date.now() + 86_400_000).toISOString(),
        reason: 'завтра',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('corrects an AUTO_CLOSED shift — the case this task exists for', async () => {
    const { prisma, created } = makePrisma(closedShift({ status: WorkShiftStatus.AUTO_CLOSED }))

    await service(prisma).createShiftCorrection(manager, 'shift-1', {
      correctedClosedAt: '2026-09-01T15:07:00.000Z',
      reason: 'автозакрытие раньше 106A',
    } as any)

    expect(created).toHaveLength(1)
  })

  it('corrects a manually CLOSED shift too', async () => {
    const { prisma, created } = makePrisma(closedShift({ status: WorkShiftStatus.CLOSED }))

    await service(prisma).createShiftCorrection(manager, 'shift-1', {
      correctedOpenedAt: '2026-09-01T06:00:00.000Z',
      reason: 'пришёл позже',
    } as any)

    expect(created).toHaveLength(1)
    expect(created[0].correctedOpenedAt).toEqual(new Date('2026-09-01T06:00:00.000Z'))
  })
})

describe('106B correction authorization is the canonical management grant', () => {
  it('requires USERS_MANAGE and excludes TECHNICIAN', () => {
    const roles = Reflect.getMetadata('roles', WorkforceController.prototype.createShiftCorrection)
    const permissions = Reflect.getMetadata(
      'permissions',
      WorkforceController.prototype.createShiftCorrection,
    )

    expect(permissions).toEqual([PERMISSIONS.USERS_MANAGE])
    expect(roles).toEqual(
      expect.arrayContaining([
        UserRole.ADMIN,
        UserRole.MASTER,
        UserRole.DISPATCHER,
        UserRole.NETWORK_DIRECTOR,
      ]),
    )
    // A technician must not be able to administratively rewrite their own history.
    expect(roles).not.toContain(UserRole.TECHNICIAN)
    expect(roles).not.toContain(UserRole.CLIENT)
  })
})
