import { BadRequestException } from '@nestjs/common'
import { TicketStatus, UserRole } from '@prisma/client'

import { TicketsAcceptanceService } from './tickets.acceptance.service'
import * as ticketAccessUtils from './ticket-access.utils'
import { AcceptanceDecision } from './dto/ticket-acceptance.dto'

jest.mock('./ticket-access.utils', () => ({
  resolveReadableTicketAccess: jest.fn(),
}))

const mockResolveReadable = ticketAccessUtils.resolveReadableTicketAccess as jest.MockedFunction<
  typeof ticketAccessUtils.resolveReadableTicketAccess
>

const PROVIDER_ID = 'provider-1'
const CLIENT_ID = 'client-1'
const TICKET_ID = 'ticket-1'

function makeAccess(overrides: any = {}): any {
  return {
    ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null },
    scopeCompanyId: CLIENT_ID,
    visibilityMode: 'tenant',
    ...overrides,
  }
}

function makeSetup(ticketStatus: TicketStatus = TicketStatus.AWAITING_ACCEPTANCE) {
  const txTicket = {
    id: TICKET_ID,
    companyId: CLIENT_ID,
    status: ticketStatus,
    slaDueAt: null,
    slaBreachedAt: null,
    closedAt: null,
  }

  const tx = {
    ticket: {
      findFirst: jest.fn().mockResolvedValue(txTicket),
      update: jest.fn().mockImplementation(async (_args: any) => ({ ...txTicket, status: _args.data.status })),
    },
    ticketAttachment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    ticketStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  }

  const prisma = {
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
  } as any

  const timeline = { recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }) }
  const serviceContracts = { getLinkedClientAccess: jest.fn().mockResolvedValue({ role: 'PRIMARY' }) }
  const svc = new TicketsAcceptanceService(prisma, timeline as any, serviceContracts as any)

  return { svc, prisma, tx, timeline }
}

describe('TicketsAcceptanceService.decide', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ACCEPT moves AWAITING_ACCEPTANCE -> DONE', async () => {
    const { svc, tx } = makeSetup()
    mockResolveReadable.mockResolvedValue(makeAccess())

    const result = await svc.decide(
      { id: 'u-1', role: UserRole.CLIENT, companyId: CLIENT_ID },
      TICKET_ID,
      { decision: AcceptanceDecision.ACCEPT },
    )

    expect(result.status).toBe(TicketStatus.DONE)
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TicketStatus.DONE }) }),
    )
  })

  it('REJECT requires comment', async () => {
    const { svc } = makeSetup()
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide(
        { id: 'u-1', role: UserRole.CLIENT, companyId: CLIENT_ID },
        TICKET_ID,
        { decision: AcceptanceDecision.REJECT },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('REJECT moves AWAITING_ACCEPTANCE -> IN_PROGRESS and marks rejection attachments', async () => {
    const { svc, tx } = makeSetup()
    mockResolveReadable.mockResolvedValue(makeAccess())

    const result = await svc.decide(
      { id: 'u-1', role: UserRole.CLIENT, companyId: CLIENT_ID },
      TICKET_ID,
      {
        decision: AcceptanceDecision.REJECT,
        comment: 'Need a rework',
        attachmentIds: ['att-1', 'att-2'],
      },
    )

    expect(result.status).toBe(TicketStatus.IN_PROGRESS)
    expect(tx.ticketAttachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ purpose: 'DECLINE_REPORT' }),
      }),
    )
    expect(tx.ticketStatusHistory.create).toHaveBeenCalled()
  })
})
