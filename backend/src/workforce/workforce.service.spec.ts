import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { CompanyType, UserRole, WorkShiftStatus } from '@prisma/client'

import { resolveTicketOperationAccess } from '../tickets/ticket-access.utils'
import {
  ACTIVE_SHIFT_REQUIRED,
  ACTIVE_SHIFT_REQUIRED_MESSAGE,
  ActiveShiftRequiredException,
} from './shift-policy.service'
import { WorkforceService } from './workforce.service'

jest.mock('../tickets/ticket-access.utils', () => ({
  resolveTicketOperationAccess: jest.fn(),
}))

const actor = { id: 'tech-1', companyId: 'provider-1', role: UserRole.TECHNICIAN }

function makePrisma() {
  return {
    user: { findFirst: jest.fn().mockResolvedValue({ id: actor.id }) },
    workShift: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    workLog: { findFirst: jest.fn().mockResolvedValue(null) },
    ticket: { findFirst: jest.fn().mockResolvedValue(null) },
    company: { findUnique: jest.fn().mockResolvedValue({ id: actor.companyId }) },
    $transaction: jest.fn(),
  } as any
}

describe('WorkforceService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('requires an open shift before ticket work can start', async () => {
    const prisma = makePrisma()
    const service = new WorkforceService(prisma, {} as any)

    await expect(service.startTicketWork(actor, 'ticket-1')).rejects.toBeInstanceOf(BadRequestException)
    expect(resolveTicketOperationAccess).not.toHaveBeenCalled()
  })

  it('enforces provider shift policy before starting ticket work', async () => {
    const prisma = makePrisma()
    const shiftPolicyService = {
      assertActiveShiftForOperationalWork: jest
        .fn()
        .mockRejectedValue(new ActiveShiftRequiredException()),
    }
    const service = new WorkforceService(prisma, {} as any, shiftPolicyService as any)

    await expect(service.startTicketWork(actor, 'ticket-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: ACTIVE_SHIFT_REQUIRED,
        message: ACTIVE_SHIFT_REQUIRED_MESSAGE,
      }),
    })

    expect(shiftPolicyService.assertActiveShiftForOperationalWork).toHaveBeenCalledWith(actor)
    expect(prisma.workShift.findFirst).not.toHaveBeenCalled()
    expect(resolveTicketOperationAccess).not.toHaveBeenCalled()
  })

  it('allows time tracking only on a ticket assigned to the employee', async () => {
    const prisma = makePrisma()
    prisma.workShift.findFirst.mockResolvedValue({ id: 'shift-1' })
    prisma.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      companyId: 'client-1',
      assignedTechnicianId: 'another-tech',
      ticketNumber: 42,
    })
    ;(resolveTicketOperationAccess as jest.Mock).mockResolvedValue({
      ticket: { id: 'ticket-1', companyId: 'client-1' },
    })
    const service = new WorkforceService(prisma, {} as any)

    await expect(service.startTicketWork(actor, 'ticket-1', 'client-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('allows stopping an already running worklog even when shift policy would block new work', async () => {
    const prisma = makePrisma()
    const running = {
      id: 'worklog-1',
      ticketId: 'ticket-1',
      startedAt: new Date('2026-08-31T08:00:00.000Z'),
      ticket: { companyId: 'client-1' },
    }
    const tx = {
      workLog: { update: jest.fn().mockResolvedValue({}) },
      domainEvent: { create: jest.fn().mockResolvedValue({}) },
    }
    prisma.workLog.findFirst.mockResolvedValue(running)
    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
    const shiftPolicyService = {
      assertActiveShiftForOperationalWork: jest
        .fn()
        .mockRejectedValue(new ActiveShiftRequiredException()),
    }
    const service = new WorkforceService(prisma, {} as any, shiftPolicyService as any)

    await expect(service.stopTicketWork(actor, 'ticket-1')).resolves.toMatchObject({
      company: { id: actor.companyId },
    })

    expect(shiftPolicyService.assertActiveShiftForOperationalWork).not.toHaveBeenCalled()
    expect(tx.workLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: running.id } }),
    )
    expect(tx.domainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ticket.work_stopped',
          entityId: 'ticket-1',
        }),
      }),
    )
  })

  it('claims an open shift atomically so duplicate auto-close workers do not emit duplicate events', async () => {
    const prisma = makePrisma()
    const tx = {
      workShift: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
      },
      workLog: { update: jest.fn() },
      domainEvent: { create: jest.fn() },
    }
    prisma.$transaction.mockImplementation((callback: any) => callback(tx))
    const service = new WorkforceService(prisma, {} as any)

    await expect(
      (service as any).closeShiftById(
        'shift-1',
        WorkShiftStatus.AUTO_CLOSED,
        null,
        'AUTO_CLOSE_19:00',
      ),
    ).resolves.toBe(false)
    expect(tx.workShift.findUnique).not.toHaveBeenCalled()
    expect(tx.domainEvent.create).not.toHaveBeenCalled()
  })

  it('exposes company shift-policy metadata through my workforce state', async () => {
    const prisma = makePrisma()
    const company = {
      id: actor.companyId,
      name: 'Provider',
      type: CompanyType.PROVIDER,
      timezone: 'UTC',
      shiftAutoCloseTime: '19:00',
      requireActiveShiftForWork: true,
    }
    prisma.company.findUnique.mockResolvedValue(company)
    const service = new WorkforceService(prisma, {} as any)

    const result = await service.getMyState(actor)

    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: actor.companyId },
      select: {
        id: true,
        name: true,
        type: true,
        timezone: true,
        shiftAutoCloseTime: true,
        requireActiveShiftForWork: true,
      },
    })
    expect(result.company).toEqual(company)
  })
})

/**
 * SMA-PROVIDER-SHIFT-POLICY-FOUNDATION-078 — settings surface.
 *
 * The policy is exposed through the existing PATCH /workforce/settings, so authorization
 * is unchanged (ADMIN + COMPANY_SETTINGS_EDIT on the controller) and there is one settings
 * endpoint rather than two.
 */
describe('WorkforceService.updateSettings — provider shift policy', () => {
  beforeEach(() => jest.clearAllMocks())

  function settingsPrisma(companyType: CompanyType = CompanyType.PROVIDER) {
    const prisma = makePrisma()
    prisma.company.findUnique.mockResolvedValue({ type: companyType })
    prisma.company.update = jest.fn(async ({ data }: any) => ({ id: actor.companyId, ...data }))
    return prisma
  }

  it('enables the policy for a PROVIDER company', async () => {
    const prisma = settingsPrisma(CompanyType.PROVIDER)
    const service = new WorkforceService(prisma, {} as any)

    await service.updateSettings(actor.companyId, { requireActiveShiftForWork: true })

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { requireActiveShiftForWork: true } }),
    )
  })

  it('refuses to enable the policy on a CLIENT company rather than storing it inert', async () => {
    const prisma = settingsPrisma(CompanyType.CLIENT)
    const service = new WorkforceService(prisma, {} as any)

    await expect(
      service.updateSettings(actor.companyId, { requireActiveShiftForWork: true }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('allows a CLIENT company to explicitly disable the policy', async () => {
    const prisma = settingsPrisma(CompanyType.CLIENT)
    const service = new WorkforceService(prisma, {} as any)

    await service.updateSettings(actor.companyId, { requireActiveShiftForWork: false })

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { requireActiveShiftForWork: false } }),
    )
  })

  it('leaves shiftAutoCloseTime untouched when only the policy is sent', async () => {
    const prisma = settingsPrisma()
    const service = new WorkforceService(prisma, {} as any)

    await service.updateSettings(actor.companyId, { requireActiveShiftForWork: true })

    const data = (prisma.company.update as jest.Mock).mock.calls[0][0].data
    expect(data).not.toHaveProperty('shiftAutoCloseTime')
  })

  it('still updates shiftAutoCloseTime on its own, as before', async () => {
    const prisma = settingsPrisma()
    const service = new WorkforceService(prisma, {} as any)

    await service.updateSettings(actor.companyId, { shiftAutoCloseTime: '21:30' })

    const data = (prisma.company.update as jest.Mock).mock.calls[0][0].data
    expect(data).toEqual({ shiftAutoCloseTime: '21:30' })
    expect(prisma.company.findUnique).not.toHaveBeenCalled()
  })

  it('rejects a malformed shiftAutoCloseTime', async () => {
    const prisma = settingsPrisma()
    const service = new WorkforceService(prisma, {} as any)

    await expect(
      service.updateSettings(actor.companyId, { shiftAutoCloseTime: '25:99' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects an empty settings payload', async () => {
    const prisma = settingsPrisma()
    const service = new WorkforceService(prisma, {} as any)

    await expect(service.updateSettings(actor.companyId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
