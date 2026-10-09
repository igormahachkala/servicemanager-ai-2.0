import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { CompanyType, ServiceContractRole, TicketStatus, UserRole } from '@prisma/client'

import { TicketsAcceptanceService } from './tickets.acceptance.service'
import * as ticketAccessUtils from './ticket-access.utils'
import { AcceptanceDecision } from './dto/ticket-acceptance.dto'
import {
  CHILD_TICKET_CANNOT_ACCEPT_CODE,
  CHILD_TICKET_CANNOT_ACCEPT_MESSAGE,
} from './ticket-is-child'
import {
  PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_CODE,
  PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_MESSAGE,
} from './ticket-close-tree'

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

function makeTicket(overrides: Record<string, any> = {}) {
  return {
    id: TICKET_ID,
    companyId: CLIENT_ID,
    status: TicketStatus.AWAITING_ACCEPTANCE,
    slaDueAt: null,
    slaBreachedAt: null,
    closedAt: null,
    assignedTechnicianId: null,
    createdByUserId: null,
    assignedTechnician: null,
    ticketNumber: 101,
    ...overrides,
  }
}

function makeSetup(opts: {
  ticketStatus?: TicketStatus
  actorRole?: UserRole
  actorCompanyType?: CompanyType
  actorActive?: boolean
  ticket?: Record<string, any>
  linkedContractRole?: ServiceContractRole | null
  /** 077: хранилище вложений, по которому мок findMany честно фильтрует. */
  attachments?: Array<{ id: string; companyId: string; ticketId: string | null; uploadedByUserId: string | null }>
  descendants?: Array<{
    id: string
    parentId: string
    companyId?: string
    status: TicketStatus
    ticketNumber?: number
    problemText?: string
    problemCategory?: { name: string } | null
  }>
} = {}) {
  const ticketStatus = opts.ticketStatus ?? TicketStatus.AWAITING_ACCEPTANCE
  const actorRole = opts.actorRole ?? UserRole.ADMIN
  const actorCompanyType = opts.actorCompanyType ?? CompanyType.CLIENT
  const actorActive = opts.actorActive ?? true
  const accessTicket = makeTicket({ status: ticketStatus, ...(opts.ticket ?? {}) })

  const txTicket = {
    id: TICKET_ID,
    companyId: CLIENT_ID,
    status: ticketStatus,
    slaDueAt: null,
    slaBreachedAt: null,
    closedAt: null,
    assignedTechnicianId: accessTicket.assignedTechnicianId,
    ticketNumber: accessTicket.ticketNumber,
    parentId: accessTicket.parentId ?? null,
  }

  const attachmentStore = opts.attachments ?? []
  const descendantStore = (opts.descendants ?? []).map((row, index) => ({
    ticketNumber: 200 + index,
    problemText: 'Child work',
    problemCategory: { name: 'Электрика' },
    companyId: CLIENT_ID,
    ...row,
  }))

  const tx = {
    ticket: {
      findFirst: jest.fn().mockResolvedValue(txTicket),
      update: jest.fn().mockImplementation(async (_args: any) => ({
        ...txTicket,
        id: _args.where?.id ?? txTicket.id,
        status: _args.data.status,
        closedAt: _args.data.closedAt ?? txTicket.closedAt,
      })),
      findMany: jest.fn().mockImplementation(async ({ where }: any) => {
        const parentIds: string[] = where?.parentId?.in ?? []
        return descendantStore.filter((row) => {
          if (where?.companyId && row.companyId !== where.companyId) return false
          return parentIds.includes(row.parentId)
        })
      }),
    },
    ticketAttachment: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      /**
       * 077: мок разбирает where, а не отдаёт заготовленный ответ. Иначе
       * проверка владения превратилась бы в проверку самого мока: подмена
       * условия в сервисе осталась бы незамеченной.
       */
      findMany: jest.fn().mockImplementation(async ({ where }: any) => {
        const ids: string[] = where?.id?.in ?? []
        return attachmentStore.filter((row) => {
          if (!ids.includes(row.id)) return false
          if (where?.companyId && row.companyId !== where.companyId) return false
          const or = where?.OR
          if (!or) return true
          return or.some((clause: any) => {
            if ('uploadedByUserId' in clause) {
              return row.ticketId === null && row.uploadedByUserId === clause.uploadedByUserId
            }
            return row.ticketId === clause.ticketId
          })
        })
      }),
    },
    ticketStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  }

  const prisma = {
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    user: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => ({
        id: where.id,
        companyId: where.companyId,
        role: actorRole,
        isActive: actorActive,
        company: { id: where.companyId, type: actorCompanyType },
      })),
    },
    ticket: { findFirst: jest.fn().mockResolvedValue(accessTicket) },
  } as any

  const timeline = { recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }) }
  const serviceContracts = {
    getLinkedClientAccess: jest.fn().mockResolvedValue(
      opts.linkedContractRole === null ? null : { role: opts.linkedContractRole ?? ServiceContractRole.PRIMARY },
    ),
  }
  const notifications = { onTicketAccepted: jest.fn(), onTicketRejected: jest.fn() }
  const svc = new TicketsAcceptanceService(prisma, timeline as any, serviceContracts as any, notifications as any)

  return { svc, prisma, tx, timeline, serviceContracts, notifications, attachmentStore }
}

// A client-company management role allowed to accept/reject.
const clientAdmin = { id: 'u-1', role: UserRole.ADMIN, companyId: CLIENT_ID }

describe('TicketsAcceptanceService.decide', () => {
  beforeEach(() => mockResolveReadable.mockReset())

  it('ACCEPT moves AWAITING_ACCEPTANCE -> DONE', async () => {
    const { svc, tx, notifications } = makeSetup({ actorRole: UserRole.ADMIN })
    mockResolveReadable.mockResolvedValue(makeAccess())

    const result = await svc.decide(clientAdmin, TICKET_ID, { decision: AcceptanceDecision.ACCEPT })

    expect(result.status).toBe(TicketStatus.DONE)
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TicketStatus.DONE }) }),
    )
    expect(notifications.onTicketAccepted).toHaveBeenCalled()
  })

  it('REJECT requires comment', async () => {
    const { svc } = makeSetup({ actorRole: UserRole.ADMIN })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide(clientAdmin, TICKET_ID, { decision: AcceptanceDecision.REJECT }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('REJECT moves AWAITING_ACCEPTANCE -> IN_PROGRESS and marks rejection attachments', async () => {
    // 077: вложения принадлежат этой же заявке — обычный путь клиентского отказа.
    const { svc, tx, notifications } = makeSetup({
      actorRole: UserRole.ADMIN,
      attachments: [
        { id: 'att-1', companyId: CLIENT_ID, ticketId: TICKET_ID, uploadedByUserId: 'u-1' },
        { id: 'att-2', companyId: CLIENT_ID, ticketId: TICKET_ID, uploadedByUserId: 'u-1' },
      ],
    })
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

  it.each([
    [UserRole.ADMIN, 'admin-provider-1'],
    [UserRole.MASTER, 'master-1'],
    [UserRole.DISPATCHER, 'dispatcher-1'],
    [UserRole.TECHNICIAN, 'tech-1'],
  ])('rejects provider %s acceptance before readable-ticket access', async (role, actorId) => {
    const providerActor = { id: actorId, role, companyId: PROVIDER_ID }
    const { svc } = makeSetup({
      actorRole: role,
      actorCompanyType: CompanyType.PROVIDER,
      ticket: {
        createdByUserId: actorId,
        assignedTechnicianId: actorId,
        assignedTechnician: { id: actorId, companyId: PROVIDER_ID },
      },
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide(providerActor, TICKET_ID, { decision: AcceptanceDecision.ACCEPT }, CLIENT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(mockResolveReadable).not.toHaveBeenCalled()
  })

  it('rejects a contractor MASTER with linked access when they neither created nor own the assignee contour', async () => {
    const master = { id: 'master-1', role: UserRole.MASTER, companyId: PROVIDER_ID }
    const { svc, prisma, serviceContracts } = makeSetup({
      actorRole: UserRole.MASTER,
      actorCompanyType: CompanyType.PROVIDER,
      linkedContractRole: ServiceContractRole.PRIMARY,
      ticket: {
        createdByUserId: 'someone-else',
        assignedTechnicianId: 'other-tech',
        assignedTechnician: { id: 'other-tech', companyId: 'other-provider' },
      },
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide(master, TICKET_ID, { decision: AcceptanceDecision.ACCEPT }, CLIENT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(serviceContracts.getLinkedClientAccess).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a contractor ADMIN with linked access when they neither created nor own the assignee contour', async () => {
    const admin = { id: 'admin-provider-1', role: UserRole.ADMIN, companyId: PROVIDER_ID }
    const { svc, prisma, serviceContracts } = makeSetup({
      actorRole: UserRole.ADMIN,
      actorCompanyType: CompanyType.PROVIDER,
      linkedContractRole: ServiceContractRole.SECONDARY,
      ticket: {
        createdByUserId: 'someone-else',
        assignedTechnicianId: 'other-tech',
        assignedTechnician: { id: 'other-tech', companyId: 'other-provider' },
      },
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide(admin, TICKET_ID, { decision: AcceptanceDecision.ACCEPT }, CLIENT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(serviceContracts.getLinkedClientAccess).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // Acceptance gates.
  it('rejects the CLIENT requester role (not a management role)', async () => {
    const { svc, prisma } = makeSetup({ actorRole: UserRole.CLIENT })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide({ id: 'u-2', role: UserRole.CLIENT, companyId: CLIENT_ID }, TICKET_ID, {
        decision: AcceptanceDecision.ACCEPT,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    // Gate fails before touching the ticket transaction.
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects an inactive actor', async () => {
    const { svc, prisma } = makeSetup({
      actorRole: UserRole.ADMIN,
      actorCompanyType: CompanyType.PROVIDER,
      actorActive: false,
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide({ id: 'u-3', role: UserRole.ADMIN, companyId: PROVIDER_ID }, TICKET_ID, {
        decision: AcceptanceDecision.ACCEPT,
      }, CLIENT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(mockResolveReadable).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects an unrelated contractor ADMIN without linked access, creator match or assignee-company match', async () => {
    const { svc, prisma } = makeSetup({
      actorRole: UserRole.ADMIN,
      actorCompanyType: CompanyType.PROVIDER,
      linkedContractRole: null,
      ticket: {
        createdByUserId: 'someone-else',
        assignedTechnicianId: 'other-tech',
        assignedTechnician: { id: 'other-tech', companyId: 'other-provider' },
      },
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide({ id: 'u-3', role: UserRole.ADMIN, companyId: PROVIDER_ID }, TICKET_ID, {
        decision: AcceptanceDecision.ACCEPT,
      }, CLIENT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a contractor DISPATCHER even when the ticket is readable', async () => {
    const { svc, prisma } = makeSetup({
      actorRole: UserRole.DISPATCHER,
      actorCompanyType: CompanyType.PROVIDER,
      ticket: { createdByUserId: 'dispatcher-1' },
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide({ id: 'dispatcher-1', role: UserRole.DISPATCHER, companyId: PROVIDER_ID }, TICKET_ID, {
        decision: AcceptanceDecision.ACCEPT,
      }, CLIENT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a technician who is not assigned to the ticket', async () => {
    const { svc, prisma } = makeSetup({
      actorRole: UserRole.TECHNICIAN,
      actorCompanyType: CompanyType.PROVIDER,
      ticket: {
        assignedTechnicianId: 'other-tech',
        assignedTechnician: { id: 'other-tech', companyId: PROVIDER_ID },
      },
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide({ id: 'tech-1', role: UserRole.TECHNICIAN, companyId: PROVIDER_ID }, TICKET_ID, {
        decision: AcceptanceDecision.ACCEPT,
      }, CLIENT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a PLATFORM_ADMIN because observer mode remains read-only for acceptance', async () => {
    const { svc, prisma } = makeSetup({
      actorRole: UserRole.PLATFORM_ADMIN,
      actorCompanyType: CompanyType.PROVIDER,
    })
    mockResolveReadable.mockResolvedValue(makeAccess({ visibilityMode: 'platform_observer' }))

    await expect(
      svc.decide({ id: 'platform-1', role: UserRole.PLATFORM_ADMIN, companyId: PROVIDER_ID }, TICKET_ID, {
        decision: AcceptanceDecision.ACCEPT,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects another tenant through the existing readable-ticket convention', async () => {
    const { svc, prisma } = makeSetup({
      actorRole: UserRole.ADMIN,
      actorCompanyType: CompanyType.CLIENT,
    })
    mockResolveReadable.mockRejectedValue(new NotFoundException('Ticket not found'))

    await expect(
      svc.decide({ id: 'u-3', role: UserRole.ADMIN, companyId: CLIENT_ID }, TICKET_ID, {
        decision: AcceptanceDecision.ACCEPT,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects repeated acceptance when the ticket is no longer awaiting acceptance', async () => {
    const { svc } = makeSetup({ actorRole: UserRole.ADMIN, ticketStatus: TicketStatus.DONE })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide(clientAdmin, TICKET_ID, { decision: AcceptanceDecision.ACCEPT }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('ACCEPT without childResolutions refuses when unresolved descendants exist', async () => {
    const { svc, tx } = makeSetup({
      actorRole: UserRole.ADMIN,
      descendants: [
        { id: 'child-open', parentId: TICKET_ID, status: TicketStatus.FIELD_COMPLETE, ticketNumber: 201, problemText: 'Pump' },
      ],
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide(clientAdmin, TICKET_ID, { decision: AcceptanceDecision.ACCEPT }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_CODE,
        message: PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_MESSAGE,
        unresolved: [
          expect.objectContaining({
            id: 'child-open',
            ticketNumber: 201,
            problemText: 'Pump',
            status: TicketStatus.FIELD_COMPLETE,
            categoryName: 'Электрика',
          }),
        ],
      }),
    })
    expect(tx.ticket.update).not.toHaveBeenCalled()
  })

  it('ACCEPT with a matching draft stamps FIELD_COMPLETE children DONE and leaves CANCELED children', async () => {
    const { svc, tx, timeline } = makeSetup({
      actorRole: UserRole.ADMIN,
      descendants: [
        { id: 'child-fc', parentId: TICKET_ID, status: TicketStatus.FIELD_COMPLETE, ticketNumber: 201 },
        { id: 'child-open', parentId: TICKET_ID, status: TicketStatus.IN_PROGRESS, ticketNumber: 202 },
        { id: 'child-canceled', parentId: TICKET_ID, status: TicketStatus.CANCELED, ticketNumber: 203 },
      ],
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    const result = await svc.decide(clientAdmin, TICKET_ID, {
      decision: AcceptanceDecision.ACCEPT,
      childResolutions: [
        { ticketId: 'child-fc', resolution: 'FIELD_COMPLETE' },
        { ticketId: 'child-open', resolution: 'FIELD_COMPLETE' },
      ],
    })

    expect(result.status).toBe(TicketStatus.DONE)
    const updates = tx.ticket.update.mock.calls.map((call: any[]) => ({
      id: call[0].where.id,
      status: call[0].data.status,
      closedAt: call[0].data.closedAt,
    }))
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'child-open', status: TicketStatus.FIELD_COMPLETE }),
        expect.objectContaining({ id: TICKET_ID, status: TicketStatus.DONE }),
        expect.objectContaining({ id: 'child-fc', status: TicketStatus.DONE, closedAt: expect.any(Date) }),
        expect.objectContaining({ id: 'child-open', status: TicketStatus.DONE, closedAt: expect.any(Date) }),
      ]),
    )
    expect(updates.some((row: any) => row.id === 'child-canceled')).toBe(false)
    expect(tx.ticketStatusHistory.create).toHaveBeenCalled()
    expect(timeline.recordTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        event: 'STATUS_CHANGED',
        companyId: CLIENT_ID,
        ticketId: 'child-fc',
        payload: { fromStatus: TicketStatus.FIELD_COMPLETE, toStatus: TicketStatus.DONE },
      }),
    )
  })

  it('REJECT without childResolutions still proceeds when unresolved descendants exist', async () => {
    const { svc, tx } = makeSetup({
      actorRole: UserRole.ADMIN,
      descendants: [
        { id: 'child-open', parentId: TICKET_ID, status: TicketStatus.IN_PROGRESS, ticketNumber: 201 },
      ],
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    const result = await svc.decide(clientAdmin, TICKET_ID, {
      decision: AcceptanceDecision.REJECT,
      comment: 'Need a rework',
    })

    expect(result.status).toBe(TicketStatus.IN_PROGRESS)
    expect(tx.ticket.findMany).not.toHaveBeenCalled()
    expect(tx.ticket.update).toHaveBeenCalledTimes(1)
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TICKET_ID },
        data: expect.objectContaining({ status: TicketStatus.IN_PROGRESS }),
      }),
    )
  })

  it('rejects child ticket decide with an explicit code, not a bare status conflict', async () => {
    const { svc, tx } = makeSetup({
      actorRole: UserRole.ADMIN,
      ticketStatus: TicketStatus.IN_PROGRESS,
      ticket: { parentId: 'parent-1' },
    })
    mockResolveReadable.mockResolvedValue(makeAccess())

    await expect(
      svc.decide(clientAdmin, TICKET_ID, { decision: AcceptanceDecision.ACCEPT }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: CHILD_TICKET_CANNOT_ACCEPT_CODE,
        message: CHILD_TICKET_CANNOT_ACCEPT_MESSAGE,
      }),
    })
    expect(tx.ticket.update).not.toHaveBeenCalled()
  })
})
