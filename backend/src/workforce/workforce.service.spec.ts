import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { UserRole, WorkShiftStatus } from '@prisma/client'

import { resolveTicketOperationAccess } from '../tickets/ticket-access.utils'
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
})
