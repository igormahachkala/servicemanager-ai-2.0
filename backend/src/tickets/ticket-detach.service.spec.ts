import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { TicketStatus, UserRole } from '@prisma/client'

import {
  TICKET_NOT_A_CHILD_CODE,
  TICKET_NOT_A_CHILD_MESSAGE,
  TicketDetachService,
} from './ticket-detach.service'
import * as ticketAccessUtils from './ticket-access.utils'

jest.mock('./ticket-access.utils', () => ({
  resolveTicketOperationAccess: jest.fn(),
}))

const mockResolveAccess = ticketAccessUtils.resolveTicketOperationAccess as jest.MockedFunction<
  typeof ticketAccessUtils.resolveTicketOperationAccess
>

const PROVIDER_ID = 'provider-1'
const CLIENT_ID = 'client-1'
const TICKET_ID = 'ticket-1'
const PARENT_ID = 'parent-1'
const USER_ID = 'user-1'

function makeAccess(overrides: Record<string, unknown> = {}) {
  return {
    ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null },
    scopeCompanyId: CLIENT_ID,
    operationCompanyId: PROVIDER_ID,
    visibilityMode: 'provider_primary',
    ...overrides,
  }
}

function makeTxTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    companyId: CLIENT_ID,
    status: TicketStatus.IN_PROGRESS,
    parentId: PARENT_ID,
    ticketNumber: 1001,
    parent: { id: PARENT_ID, ticketNumber: 42 },
    ...overrides,
  }
}

function makeSetup(opts: { txTicket?: ReturnType<typeof makeTxTicket> } = {}) {
  const txTicket = opts.txTicket ?? makeTxTicket()
  const updatedTicket = {
    ...txTicket,
    parentId: null,
    parent: null,
    status:
      txTicket.status === TicketStatus.FIELD_COMPLETE
        ? TicketStatus.AWAITING_ACCEPTANCE
        : txTicket.status,
  }

  const tx = {
    ticket: {
      findFirst: jest.fn().mockResolvedValue(txTicket),
      update: jest.fn().mockResolvedValue(updatedTicket),
    },
    ticketStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
    },
  }

  const prisma = {
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
  } as any

  const timeline = { recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }) }

  const svc = new TicketDetachService(prisma, {} as any, timeline as any)
  return { svc, prisma, tx, timeline, updatedTicket }
}

function detach(
  svc: TicketDetachService,
  role: UserRole = UserRole.ADMIN,
  linkedClientCompanyId?: string,
) {
  return svc.detachFromParent(
    PROVIDER_ID,
    { id: USER_ID },
    role,
    TICKET_ID,
    linkedClientCompanyId,
  )
}

describe('TicketDetachService.detachFromParent', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a non-ADMIN actor', async () => {
    const { svc, prisma } = makeSetup()

    await expect(detach(svc, UserRole.MASTER)).rejects.toBeInstanceOf(ForbiddenException)
    expect(mockResolveAccess).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a ticket that is not a child', async () => {
    const { svc, tx } = makeSetup({
      txTicket: makeTxTicket({ parentId: undefined, parent: null }),
    })
    mockResolveAccess.mockResolvedValue(makeAccess())

    await expect(detach(svc)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: TICKET_NOT_A_CHILD_CODE,
        message: TICKET_NOT_A_CHILD_MESSAGE,
      }),
    })
    expect(tx.ticket.update).not.toHaveBeenCalled()
    expect(tx.ticketStatusHistory.create).not.toHaveBeenCalled()
  })

  it('rejects when parentId is already null', async () => {
    const { svc, tx } = makeSetup({
      txTicket: makeTxTicket({ parentId: null, parent: null }),
    })
    mockResolveAccess.mockResolvedValue(makeAccess())

    await expect(detach(svc)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: TICKET_NOT_A_CHILD_CODE,
        message: TICKET_NOT_A_CHILD_MESSAGE,
      }),
    })
    expect(tx.ticket.update).not.toHaveBeenCalled()
  })

  it('FIELD_COMPLETE becomes AWAITING_ACCEPTANCE and records detach with parent identity', async () => {
    const { svc, tx, timeline, updatedTicket } = makeSetup({
      txTicket: makeTxTicket({ status: TicketStatus.FIELD_COMPLETE }),
    })
    mockResolveAccess.mockResolvedValue(makeAccess())

    const result = await detach(svc, UserRole.ADMIN, 'linked-client-1')

    expect(result.parentId).toBeNull()
    expect(result.status).toBe(TicketStatus.AWAITING_ACCEPTANCE)
    expect(result.status).not.toBe(TicketStatus.DONE)
    expect(updatedTicket.status).toBe(TicketStatus.AWAITING_ACCEPTANCE)

    expect(mockResolveAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: TICKET_ID,
        linkedClientCompanyId: 'linked-client-1',
        actor: expect.objectContaining({
          id: USER_ID,
          role: UserRole.ADMIN,
          companyId: PROVIDER_ID,
        }),
      }),
    )
    expect(tx.ticket.findFirst).toHaveBeenCalledWith({
      where: { id: TICKET_ID, companyId: CLIENT_ID },
      include: {
        parent: {
          select: { id: true, ticketNumber: true },
        },
      },
    })
    expect(tx.ticket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: {
        parentId: null,
        status: TicketStatus.AWAITING_ACCEPTANCE,
        statusUpdatedAt: expect.any(Date),
      },
    })
    expect(tx.ticket.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TicketStatus.DONE }),
      }),
    )
    expect(tx.ticketStatusHistory.create).toHaveBeenCalledWith({
      data: {
        ticketId: TICKET_ID,
        fromStatus: TicketStatus.FIELD_COMPLETE,
        toStatus: TicketStatus.AWAITING_ACCEPTANCE,
        comment: null,
        changedByUserId: USER_ID,
      },
    })
    expect(timeline.recordTx).toHaveBeenCalledTimes(3)
    expect(timeline.recordTx).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({
        event: 'TICKET_DETACHED_FROM_PARENT',
        companyId: CLIENT_ID,
        ticketId: TICKET_ID,
        actorUserId: USER_ID,
        payload: {
          parentId: PARENT_ID,
          parentTicketNumber: 42,
        },
      }),
    )
    expect(timeline.recordTx).toHaveBeenNthCalledWith(
      2,
      tx,
      expect.objectContaining({
        event: 'STATUS_CHANGED',
        payload: {
          fromStatus: TicketStatus.FIELD_COMPLETE,
          toStatus: TicketStatus.AWAITING_ACCEPTANCE,
          comment: null,
        },
      }),
    )
    expect(timeline.recordTx).toHaveBeenNthCalledWith(
      3,
      tx,
      expect.objectContaining({
        event: 'TICKET_READY_FOR_ACCEPTANCE',
        payload: {
          fromStatus: TicketStatus.FIELD_COMPLETE,
          toStatus: TicketStatus.AWAITING_ACCEPTANCE,
        },
      }),
    )
    expect(timeline.recordTx.mock.calls[1][1].payload.failureCauseId).toBeUndefined()
    expect(timeline.recordTx.mock.calls[2][1].payload.failureCauseId).toBeUndefined()
  })

  it('keeps IN_PROGRESS and only clears parentId', async () => {
    const { svc, tx, timeline } = makeSetup({
      txTicket: makeTxTicket({ status: TicketStatus.IN_PROGRESS }),
    })
    mockResolveAccess.mockResolvedValue(makeAccess())

    const result = await detach(svc)

    expect(result.status).toBe(TicketStatus.IN_PROGRESS)
    expect(result.parentId).toBeNull()
    expect(tx.ticket.update).toHaveBeenCalledWith({
      where: { id: TICKET_ID },
      data: { parentId: null },
    })
    expect(tx.ticketStatusHistory.create).not.toHaveBeenCalled()
    expect(timeline.recordTx).toHaveBeenCalledTimes(1)
    expect(timeline.recordTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        event: 'TICKET_DETACHED_FROM_PARENT',
        payload: {
          parentId: PARENT_ID,
          parentTicketNumber: 42,
        },
      }),
    )
  })

  it('does not find a ticket of another company', async () => {
    const { svc, tx, timeline } = makeSetup()
    tx.ticket.findFirst.mockResolvedValue(null)
    mockResolveAccess.mockResolvedValue(makeAccess())

    await expect(detach(svc)).rejects.toBeInstanceOf(NotFoundException)
    expect(tx.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TICKET_ID, companyId: CLIENT_ID },
      }),
    )
    expect(tx.ticket.update).not.toHaveBeenCalled()
    expect(timeline.recordTx).not.toHaveBeenCalled()
  })
})
