import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { TicketStatus, UserRole } from '@prisma/client'

import { TicketsStatusService } from './tickets.status.service'
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
const USER_ID = 'user-1'
const TECH_ID = 'tech-1'

function makeAccess(overrides: any = {}): any {
  return {
    ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null },
    scopeCompanyId: CLIENT_ID,
    operationCompanyId: PROVIDER_ID,
    visibilityMode: 'provider_primary',
    ...overrides,
  }
}

function makeTxTicket(overrides: any = {}) {
  return {
    id: TICKET_ID,
    companyId: CLIENT_ID,
    status: TicketStatus.ASSIGNED,
    assignedTechnicianId: null,
    slaDueAt: null,
    slaBreachedAt: null,
    closedAt: null,
    ticketNumber: 42,
    problemText: 'Test',
    locationId: 'loc-1',
    ...overrides,
  }
}

function makeSetup(opts: {
  companyType?: string
  isExecutor?: boolean
  txTicket?: ReturnType<typeof makeTxTicket>
  updatedStatus?: TicketStatus
} = {}) {
  const {
    companyType = 'PROVIDER',
    isExecutor = false,
    txTicket = makeTxTicket(),
    updatedStatus = TicketStatus.IN_PROGRESS,
  } = opts

  const updatedTicket = { ...txTicket, status: updatedStatus }

  const tx = {
    ticket: {
      findFirst: jest.fn().mockResolvedValue(txTicket),
      update: jest.fn().mockResolvedValue(updatedTicket),
    },
    ticketStatusHistory: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    ticketAttachment: { count: jest.fn().mockResolvedValue(0) },
    domainEvent: { count: jest.fn().mockResolvedValue(0) },
  }

  const prisma = {
    company: { findUnique: jest.fn().mockResolvedValue({ id: PROVIDER_ID, type: companyType }) },
    user: {
      findFirst: jest.fn().mockResolvedValue({ isExecutor }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
  } as any

  const timeline = { recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }) }
  const notifications = {
    scheduleTicketStatusChanged: jest.fn(),
    scheduleTicketStatusAssignee: jest.fn(),
    scheduleTicketCommentAdded: jest.fn(),
    onTicketInProgress: jest.fn(),
    onTicketDone: jest.fn(),
  }

  const svc = new TicketsStatusService(prisma, timeline as any, {} as any, notifications as any)
  return { svc, prisma, tx, timeline, notifications }
}

describe('TicketsStatusService.updateStatus', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ADMIN changes ASSIGNED→IN_PROGRESS: ticket updated and notifications fired', async () => {
    const { svc, tx, notifications } = makeSetup()
    mockResolveAccess.mockResolvedValue(makeAccess())

    await svc.updateStatus(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
      status: TicketStatus.IN_PROGRESS,
    })

    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TicketStatus.IN_PROGRESS }) }),
    )
    expect(tx.ticketStatusHistory.create).toHaveBeenCalled()
    expect(notifications.scheduleTicketStatusChanged).toHaveBeenCalled()
    expect(notifications.onTicketInProgress).toHaveBeenCalled()
  })

  it.each([
    [UserRole.MASTER, 'MASTER'],
    [UserRole.DISPATCHER, 'DISPATCHER'],
  ])('%s executor changes ASSIGNED→IN_PROGRESS on own ticket', async (role) => {
    const txTicket = makeTxTicket({ companyId: PROVIDER_ID, assignedTechnicianId: USER_ID })
    const { svc, tx, notifications } = makeSetup({ isExecutor: true, txTicket })
    mockResolveAccess.mockResolvedValue(
      makeAccess({
        ticket: { id: TICKET_ID, companyId: PROVIDER_ID, assignedTechnicianId: USER_ID },
        operationCompanyId: PROVIDER_ID,
        visibilityMode: 'tenant',
      }),
    )

    await svc.updateStatus(PROVIDER_ID, { id: USER_ID }, role, TICKET_ID, {
      status: TicketStatus.IN_PROGRESS,
    })

    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TicketStatus.IN_PROGRESS }) }),
    )
    expect(notifications.scheduleTicketStatusChanged).toHaveBeenCalled()
    expect(notifications.onTicketInProgress).toHaveBeenCalled()
  })

  it('TECHNICIAN executor changes status on own assigned ticket', async () => {
    const txTicket = makeTxTicket({ companyId: PROVIDER_ID, assignedTechnicianId: TECH_ID })
    const { svc, tx } = makeSetup({ isExecutor: true, txTicket })
    mockResolveAccess.mockResolvedValue(
      makeAccess({
        ticket: { id: TICKET_ID, companyId: PROVIDER_ID, assignedTechnicianId: TECH_ID },
        operationCompanyId: PROVIDER_ID,
        visibilityMode: 'tenant',
      }),
    )

    await svc.updateStatus(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, {
      status: TicketStatus.IN_PROGRESS,
    })

    expect(tx.ticket.update).toHaveBeenCalled()
  })

  it('maps technician completion DONE→AWAITING_ACCEPTANCE', async () => {
    const txTicket = makeTxTicket({ status: TicketStatus.IN_PROGRESS, companyId: PROVIDER_ID, assignedTechnicianId: TECH_ID })
    const { svc, tx, notifications } = makeSetup({
      isExecutor: true,
      txTicket,
      updatedStatus: TicketStatus.AWAITING_ACCEPTANCE,
    })
    tx.ticketAttachment.count.mockResolvedValue(1)
    tx.domainEvent.count.mockResolvedValue(1)
    mockResolveAccess.mockResolvedValue(
      makeAccess({
        ticket: { id: TICKET_ID, companyId: PROVIDER_ID, assignedTechnicianId: TECH_ID },
        operationCompanyId: PROVIDER_ID,
        visibilityMode: 'tenant',
      }),
    )

    await svc.updateStatus(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, {
      status: TicketStatus.DONE,
    })

    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: TicketStatus.AWAITING_ACCEPTANCE }) }),
    )
    expect(notifications.onTicketDone).not.toHaveBeenCalled()
  })

  it('denies executor not assigned to the ticket (ForbiddenException)', async () => {
    const txTicket = makeTxTicket({ companyId: PROVIDER_ID, assignedTechnicianId: 'other-tech' })
    const { svc } = makeSetup({ isExecutor: true, txTicket })
    mockResolveAccess.mockResolvedValue(
      makeAccess({
        ticket: { id: TICKET_ID, companyId: PROVIDER_ID, assignedTechnicianId: 'other-tech' },
        operationCompanyId: PROVIDER_ID,
        visibilityMode: 'tenant',
      }),
    )

    await expect(
      svc.updateStatus(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, {
        status: TicketStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('rejects invalid workflow transition DONE→IN_PROGRESS (BadRequestException)', async () => {
    const { svc } = makeSetup({ txTicket: makeTxTicket({ status: TicketStatus.DONE }) })
    mockResolveAccess.mockResolvedValue(makeAccess())

    await expect(
      svc.updateStatus(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
        status: TicketStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects CLIENT company before accessing ticket (ForbiddenException)', async () => {
    const { svc } = makeSetup({ companyType: 'CLIENT' })

    await expect(
      svc.updateStatus('client-co', { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
        status: TicketStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(mockResolveAccess).not.toHaveBeenCalled()
  })

  it('rejects completion without work report photo (BadRequestException)', async () => {
    const txTicket = makeTxTicket({ status: TicketStatus.IN_PROGRESS })
    const { svc, tx } = makeSetup({ txTicket, updatedStatus: TicketStatus.AWAITING_ACCEPTANCE })
    tx.ticketAttachment.count.mockResolvedValue(0)
    mockResolveAccess.mockResolvedValue(makeAccess())

    await expect(
      svc.updateStatus(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
        status: TicketStatus.DONE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('writes comment event to timeline when comment is provided', async () => {
    const { svc, timeline } = makeSetup()
    mockResolveAccess.mockResolvedValue(makeAccess())

    await svc.updateStatus(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
      status: TicketStatus.IN_PROGRESS,
      comment: 'Starting work',
    })

    // STATUS_CHANGED + COMMENT_ADDED = 2 calls
    expect(timeline.recordTx).toHaveBeenCalledTimes(2)
    expect(timeline.recordTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ event: 'COMMENT_ADDED' }),
    )
  })
})

describe('TicketsStatusService.addComment', () => {
  beforeEach(() => jest.clearAllMocks())

  function makeCommentSetup(opts: { companyType?: string; isExecutor?: boolean; role?: UserRole } = {}) {
    const { companyType = 'CLIENT', isExecutor = false, role: _role = UserRole.CLIENT } = opts
    const txTicket = makeTxTicket({ companyId: CLIENT_ID, assignedTechnicianId: null })
    const tx = {
      ticket: { findFirst: jest.fn().mockResolvedValue(txTicket) },
      ticketStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    }
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ isExecutor }), findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    } as any
    const timeline = { recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }) }
    const notifications = { scheduleTicketCommentAdded: jest.fn() }
    const svc = new TicketsStatusService(prisma, timeline as any, {} as any, notifications as any)
    return { svc, prisma, tx, timeline, notifications }
  }

  it('CLIENT can add comment on own tenant ticket', async () => {
    const { svc, timeline } = makeCommentSetup()
    mockResolveAccess.mockResolvedValue(
      makeAccess({ ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null }, operationCompanyId: CLIENT_ID, visibilityMode: 'tenant' }),
    )

    const result = await svc.addComment(CLIENT_ID, { id: USER_ID }, UserRole.CLIENT, TICKET_ID, { comment: 'Hello' })

    expect(result).toEqual({ ok: true })
    expect(timeline.recordTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ event: 'COMMENT_ADDED' }),
    )
  })

  it('ADMIN can add comment', async () => {
    const { svc } = makeCommentSetup()
    mockResolveAccess.mockResolvedValue(makeAccess({ operationCompanyId: PROVIDER_ID }))

    await expect(
      svc.addComment(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, { comment: 'Checking' }),
    ).resolves.toEqual({ ok: true })
  })

  it('TECHNICIAN executor can add comment', async () => {
    const { svc } = makeCommentSetup({ isExecutor: true })
    mockResolveAccess.mockResolvedValue(
      makeAccess({ ticket: { id: TICKET_ID, companyId: PROVIDER_ID, assignedTechnicianId: TECH_ID }, operationCompanyId: PROVIDER_ID, visibilityMode: 'tenant' }),
    )

    await expect(
      svc.addComment(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, { comment: 'Done' }),
    ).resolves.toEqual({ ok: true })
  })

  it('rejects empty comment (BadRequestException)', async () => {
    const { svc } = makeCommentSetup()

    await expect(
      svc.addComment(CLIENT_ID, { id: USER_ID }, UserRole.CLIENT, TICKET_ID, { comment: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(mockResolveAccess).not.toHaveBeenCalled()
  })
})
