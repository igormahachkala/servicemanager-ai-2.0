import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { CompanyType, TicketStatus, UserRole } from '@prisma/client'

import { TicketsAcceptanceService } from './tickets.acceptance.service'
import * as ticketAccessUtils from './ticket-access.utils'
import { AcceptanceDecision } from './dto/ticket-acceptance.dto'

jest.mock('./ticket-access.utils', () => ({
  resolveReadableTicketAccess: jest.fn(),
}))

const mockResolveReadable = ticketAccessUtils.resolveReadableTicketAccess as jest.MockedFunction<
  typeof ticketAccessUtils.resolveReadableTicketAccess
>

const CLIENT_ID = 'client-1'
const PROVIDER_ID = 'provider-1'
const TICKET_ID = 'ticket-1'

function makeAccess(overrides: any = {}): any {
  return {
    ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null },
    scopeCompanyId: CLIENT_ID,
    visibilityMode: 'tenant',
    ...overrides,
  }
}

function makeSetup(opts: { ticketStatus?: TicketStatus; actorCompanyType?: CompanyType } = {}) {
  const ticketStatus = opts.ticketStatus ?? TicketStatus.AWAITING_ACCEPTANCE
  const actorCompanyType = opts.actorCompanyType ?? CompanyType.CLIENT

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
    // SMA-ACCEPTANCE-ROLE-GAP-001: actor-company-type lookup for the client-side gate.
    company: { findUnique: jest.fn().mockResolvedValue({ id: 'co', type: actorCompanyType }) },
  } as any

  const timeline = { recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }) }
  const serviceContracts = { getLinkedClientAccess: jest.fn().mockResolvedValue({ role: 'PRIMARY' }) }
  const notifications = { onTicketAccepted: jest.fn(), onTicketRejected: jest.fn() }
  const svc = new TicketsAcceptanceService(prisma, timeline as any, serviceContracts as any, notifications as any)

  return { svc, prisma, tx, timeline, notifications }
}

// A client-company management role allowed to accept/reject.
const clientAdmin = { id: 'u-1', role: UserRole.ADMIN, companyId: CLIENT_ID }

describe('TicketsAcceptanceService.decide', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ACCEPT moves AWAITING_ACCEPTANCE -> DONE', async () => {
    const { svc, tx, notifications } = makeSetup()
    mockResolveReadable.mockResolvedValue(makeAccess())

    const result = await svc.decide(clientAdmin, TICKET_ID, { decision: AcceptanceDecision.ACCEPT })

    expect(result.status).toBe(TicketStatus.DONE)
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TicketStatus.DONE }) }),
    )
    expect(notifications.onTicketAccepted).toHaveBeenCalled()
  })

  it('REJECT requires comment', async () => {
    const { svc } = makeSetup()
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide(clientAdmin, TICKET_ID, { decision: AcceptanceDecision.REJECT }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('REJECT moves AWAITING_ACCEPTANCE -> IN_PROGRESS and marks rejection attachments', async () => {
    const { svc, tx, notifications } = makeSetup()
    mockResolveReadable.mockResolvedValue(makeAccess())

    const result = await svc.decide(clientAdmin, TICKET_ID, {
      decision: AcceptanceDecision.REJECT,
      comment: 'Need a rework',
      attachmentIds: ['att-1', 'att-2'],
    })

    expect(result.status).toBe(TicketStatus.IN_PROGRESS)
    expect(tx.ticketAttachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ purpose: 'DECLINE_REPORT' }),
      }),
    )
    expect(tx.ticketStatusHistory.create).toHaveBeenCalled()
    expect(notifications.onTicketRejected).toHaveBeenCalled()
  })

  // SMA-ACCEPTANCE-ROLE-GAP-001 — policy gates.
  it('rejects the CLIENT requester role (not a management role)', async () => {
    const { svc, prisma } = makeSetup()
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide({ id: 'u-2', role: UserRole.CLIENT, companyId: CLIENT_ID }, TICKET_ID, {
        decision: AcceptanceDecision.ACCEPT,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    // Gate fails before touching the ticket transaction.
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a provider-company actor (cannot accept own work)', async () => {
    const { svc, prisma } = makeSetup({ actorCompanyType: CompanyType.PROVIDER })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide({ id: 'u-3', role: UserRole.ADMIN, companyId: PROVIDER_ID }, TICKET_ID, {
        decision: AcceptanceDecision.ACCEPT,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
