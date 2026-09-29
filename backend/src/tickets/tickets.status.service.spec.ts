import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { TicketStatus, UserRole } from '@prisma/client'

import { TicketsStatusService } from './tickets.status.service'
import * as ticketAccessUtils from './ticket-access.utils'
import {
  ACTIVE_SHIFT_REQUIRED,
  ACTIVE_SHIFT_REQUIRED_MESSAGE,
  ActiveShiftRequiredException,
} from '../workforce/shift-policy.service'

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
  shiftPolicyService?: any
  idempotency?: any
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
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'history-1', ticketId: TICKET_ID, toStatus: TicketStatus.AWAITING_ACCEPTANCE }),
      count: jest.fn().mockResolvedValue(0),
    },
    ticketAttachment: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    domainEvent: { count: jest.fn().mockResolvedValue(0) },
    failureCause: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cause-1', name: 'Износ' }),
    },
    ticketFailureCauseAssessment: {
      create: jest.fn().mockResolvedValue({ id: 'assessment-1' }),
    },
    // 120H: комментарий стал отдельной строкой; отвечать здесь не на что.
    ticketComment: {
      create: jest.fn().mockResolvedValue({ id: 'tc-1' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  }

  const prisma = {
    company: { findUnique: jest.fn().mockResolvedValue({ id: PROVIDER_ID, type: companyType }) },
    user: {
      findFirst: jest.fn().mockResolvedValue({ isExecutor }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    ticket: {
      findFirst: jest.fn().mockResolvedValue(updatedTicket),
    },
    ticketStatusHistory: {
      findUnique: jest.fn().mockResolvedValue({ id: 'history-1', ticketId: TICKET_ID, toStatus: TicketStatus.AWAITING_ACCEPTANCE }),
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
    onTicketAwaitingAcceptance: jest.fn(),
  }

  const svc = new TicketsStatusService(
    prisma,
    timeline as any,
    {} as any,
    notifications as any,
    opts.shiftPolicyService as any,
    opts.idempotency as any,
  )
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

  it('rejects forbidden status update before ticket mutation', async () => {
    const { svc, prisma } = makeSetup()
    mockResolveAccess.mockRejectedValue(new NotFoundException('Ticket not found'))

    await expect(
      svc.updateStatus(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, {
        status: TicketStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)

    expect(prisma.$transaction).not.toHaveBeenCalled()
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

  it.each([UserRole.TECHNICIAN, UserRole.MASTER])(
    'blocks provider %s status mutation without an active shift before writes',
    async (role) => {
      const shiftPolicyService = {
        assertActiveShiftForOperationalWork: jest
          .fn()
          .mockRejectedValue(new ActiveShiftRequiredException()),
      }
      const txTicket = makeTxTicket({
        companyId: PROVIDER_ID,
        assignedTechnicianId: USER_ID,
      })
      const { svc, prisma, tx, timeline, notifications } = makeSetup({
        isExecutor: true,
        txTicket,
        shiftPolicyService,
      })
      mockResolveAccess.mockResolvedValue(
        makeAccess({
          ticket: { id: TICKET_ID, companyId: PROVIDER_ID, assignedTechnicianId: USER_ID },
          operationCompanyId: PROVIDER_ID,
          visibilityMode: 'tenant',
        }),
      )

      await expect(
        svc.updateStatus(PROVIDER_ID, { id: USER_ID }, role, TICKET_ID, {
          status: TicketStatus.IN_PROGRESS,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: ACTIVE_SHIFT_REQUIRED,
          message: ACTIVE_SHIFT_REQUIRED_MESSAGE,
        }),
      })

      expect(shiftPolicyService.assertActiveShiftForOperationalWork).toHaveBeenCalledWith({
        id: USER_ID,
        role,
        companyId: PROVIDER_ID,
      })
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(tx.ticket.update).not.toHaveBeenCalled()
      expect(timeline.recordTx).not.toHaveBeenCalled()
      expect(notifications.scheduleTicketStatusChanged).not.toHaveBeenCalled()
    },
  )

  it('blocks provider completion without an active shift before awaiting-acceptance writes', async () => {
    const shiftPolicyService = {
      assertActiveShiftForOperationalWork: jest
        .fn()
        .mockRejectedValue(new ActiveShiftRequiredException()),
    }
    const txTicket = makeTxTicket({
      status: TicketStatus.IN_PROGRESS,
      companyId: PROVIDER_ID,
      assignedTechnicianId: TECH_ID,
    })
    const { svc, prisma, tx, timeline, notifications } = makeSetup({
      isExecutor: true,
      txTicket,
      updatedStatus: TicketStatus.AWAITING_ACCEPTANCE,
      shiftPolicyService,
    })
    mockResolveAccess.mockResolvedValue(
      makeAccess({
        ticket: { id: TICKET_ID, companyId: PROVIDER_ID, assignedTechnicianId: TECH_ID },
        operationCompanyId: PROVIDER_ID,
        visibilityMode: 'tenant',
      }),
    )

    await expect(
      svc.updateStatus(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, {
        status: TicketStatus.DONE,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: ACTIVE_SHIFT_REQUIRED,
        message: ACTIVE_SHIFT_REQUIRED_MESSAGE,
      }),
    })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.ticket.update).not.toHaveBeenCalled()
    expect(timeline.recordTx).not.toHaveBeenCalled()
    expect(notifications.onTicketAwaitingAcceptance).not.toHaveBeenCalled()
  })

  it('denies direct completion DONE→AWAITING_ACCEPTANCE without failure cause', async () => {
    const txTicket = makeTxTicket({ status: TicketStatus.IN_PROGRESS, companyId: PROVIDER_ID, assignedTechnicianId: TECH_ID })
    const { svc, tx, timeline, notifications } = makeSetup({
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

    await expect(
      svc.updateStatus(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, {
        status: TicketStatus.DONE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(tx.ticket.update).not.toHaveBeenCalled()
    expect(tx.ticketStatusHistory.create).not.toHaveBeenCalled()
    expect(timeline.recordTx).not.toHaveBeenCalled()
    expect(notifications.onTicketDone).not.toHaveBeenCalled()
    expect(notifications.onTicketAwaitingAcceptance).not.toHaveBeenCalled()
  })

  it.each([
    [UserRole.ADMIN, false],
    [UserRole.MASTER, false],
    [UserRole.DISPATCHER, false],
    [UserRole.TECHNICIAN, true],
  ])('denies provider %s from accepting awaiting work via status DONE', async (role, isExecutor) => {
    const txTicket = makeTxTicket({
      status: TicketStatus.AWAITING_ACCEPTANCE,
      companyId: PROVIDER_ID,
      assignedTechnicianId: USER_ID,
    })
    const { svc, tx, timeline, notifications } = makeSetup({ isExecutor, txTicket })
    mockResolveAccess.mockResolvedValue(
      makeAccess({
        ticket: { id: TICKET_ID, companyId: PROVIDER_ID, assignedTechnicianId: USER_ID },
        operationCompanyId: PROVIDER_ID,
        visibilityMode: 'tenant',
      }),
    )

    await expect(
      svc.updateStatus(PROVIDER_ID, { id: USER_ID }, role, TICKET_ID, {
        status: TicketStatus.DONE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(tx.ticket.update).not.toHaveBeenCalled()
    expect(tx.ticketStatusHistory.create).not.toHaveBeenCalled()
    expect(timeline.recordTx).not.toHaveBeenCalled()
    expect(notifications.scheduleTicketStatusChanged).not.toHaveBeenCalled()
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

  it('rejects submit-acceptance without work report photo or video (BadRequestException)', async () => {
    const txTicket = makeTxTicket({ status: TicketStatus.IN_PROGRESS })
    const { svc, tx } = makeSetup({ txTicket, updatedStatus: TicketStatus.AWAITING_ACCEPTANCE })
    tx.ticketAttachment.count.mockResolvedValue(0)
    mockResolveAccess.mockResolvedValue(makeAccess())

    await expect(
      svc.submitAcceptance(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
        failureCauseId: 'cause-1',
        comment: 'Done',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('submit-acceptance writes status history and immutable failure-cause assessment', async () => {
    const txTicket = makeTxTicket({ status: TicketStatus.IN_PROGRESS, assignedTechnicianId: TECH_ID })
    const { svc, tx, timeline, notifications } = makeSetup({
      isExecutor: true,
      txTicket,
      updatedStatus: TicketStatus.AWAITING_ACCEPTANCE,
    })
    tx.ticketAttachment.count.mockResolvedValue(1)
    tx.domainEvent.count.mockResolvedValue(0)
    mockResolveAccess.mockResolvedValue(
      makeAccess({
        ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: TECH_ID },
        operationCompanyId: PROVIDER_ID,
        visibilityMode: 'provider_primary',
      }),
    )

    const result = await svc.submitAcceptance(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, {
      failureCauseId: 'cause-1',
      comment: 'Заменил деталь',
    })

    expect(result.status).toBe(TicketStatus.AWAITING_ACCEPTANCE)
    expect(tx.ticketStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: TICKET_ID,
          fromStatus: TicketStatus.IN_PROGRESS,
          toStatus: TicketStatus.AWAITING_ACCEPTANCE,
          comment: 'Заменил деталь',
          changedByUserId: TECH_ID,
        }),
      }),
    )
    expect(tx.ticketFailureCauseAssessment.create).toHaveBeenCalledWith({
      data: {
        companyId: CLIENT_ID,
        ticketId: TICKET_ID,
        ticketStatusHistoryId: 'history-1',
        failureCauseId: 'cause-1',
        failureCauseNameSnapshot: 'Износ',
        actorUserId: TECH_ID,
      },
    })
    expect(timeline.recordTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'STATUS_CHANGED',
        payload: expect.objectContaining({
          ticketStatusHistoryId: 'history-1',
          failureCauseAssessmentId: 'assessment-1',
          failureCauseNameSnapshot: 'Износ',
        }),
      }),
    )
    expect(notifications.onTicketAwaitingAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketCompanyId: CLIENT_ID,
        actorUserId: TECH_ID,
        ticketId: TICKET_ID,
      }),
    )
  })

  it('rejects inactive, foreign, or wrong-company cause before status writes', async () => {
    const txTicket = makeTxTicket({ status: TicketStatus.IN_PROGRESS })
    const { svc, tx, timeline } = makeSetup({ txTicket, updatedStatus: TicketStatus.AWAITING_ACCEPTANCE })
    tx.ticketAttachment.count.mockResolvedValue(1)
    tx.failureCause.findFirst.mockResolvedValue(null)
    mockResolveAccess.mockResolvedValue(makeAccess())

    await expect(
      svc.submitAcceptance(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
        failureCauseId: 'foreign-cause',
        comment: 'Done',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(tx.failureCause.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'foreign-cause',
        companyId: CLIENT_ID,
        active: true,
      },
      select: { id: true, name: true },
    })
    expect(tx.ticket.update).not.toHaveBeenCalled()
    expect(tx.ticketFailureCauseAssessment.create).not.toHaveBeenCalled()
    expect(timeline.recordTx).not.toHaveBeenCalled()
  })

  it('rejects submit-acceptance without a comment when no historical comment exists', async () => {
    const txTicket = makeTxTicket({ status: TicketStatus.IN_PROGRESS })
    const { svc, tx } = makeSetup({ txTicket, updatedStatus: TicketStatus.AWAITING_ACCEPTANCE })
    tx.ticketAttachment.count.mockResolvedValue(1)
    tx.domainEvent.count.mockResolvedValue(0)
    tx.ticketStatusHistory.count.mockResolvedValue(0)
    mockResolveAccess.mockResolvedValue(makeAccess())

    await expect(
      svc.submitAcceptance(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
        failureCauseId: 'cause-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(tx.ticket.update).not.toHaveBeenCalled()
    expect(tx.ticketFailureCauseAssessment.create).not.toHaveBeenCalled()
  })

  it('resubmit after rejection creates a second assessment without mutating the first', async () => {
    const txTicket = makeTxTicket({ status: TicketStatus.IN_PROGRESS })
    const { svc, tx } = makeSetup({ txTicket, updatedStatus: TicketStatus.AWAITING_ACCEPTANCE })
    tx.ticketAttachment.count.mockResolvedValue(1)
    tx.ticketStatusHistory.create
      .mockResolvedValueOnce({ id: 'history-1' })
      .mockResolvedValueOnce({ id: 'history-2' })
    tx.failureCause.findFirst
      .mockResolvedValueOnce({ id: 'cause-1', name: 'Износ' })
      .mockResolvedValueOnce({ id: 'cause-2', name: 'Ошибка эксплуатации' })
    mockResolveAccess.mockResolvedValue(makeAccess())

    await svc.submitAcceptance(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
      failureCauseId: 'cause-1',
      comment: 'Первая попытка',
    })
    await svc.submitAcceptance(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
      failureCauseId: 'cause-2',
      comment: 'Повторная попытка',
    })

    expect(tx.ticketFailureCauseAssessment.create).toHaveBeenCalledTimes(2)
    expect(tx.ticketFailureCauseAssessment.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        ticketStatusHistoryId: 'history-1',
        failureCauseId: 'cause-1',
        failureCauseNameSnapshot: 'Износ',
      }),
    })
    expect(tx.ticketFailureCauseAssessment.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        ticketStatusHistoryId: 'history-2',
        failureCauseId: 'cause-2',
        failureCauseNameSnapshot: 'Ошибка эксплуатации',
      }),
    })
  })

  it('submit-acceptance idempotency reuses the canonical key result', async () => {
    const txTicket = makeTxTicket({ status: TicketStatus.IN_PROGRESS })
    const idempotency = {
      run: jest.fn().mockImplementation(async (_scope: any, _fingerprint: string, handlers: any) => {
        const executed = await handlers.execute({ noteStorageKey: jest.fn() })
        return { result: executed.result, executed: true }
      }),
    }
    const { svc, tx } = makeSetup({
      txTicket,
      updatedStatus: TicketStatus.AWAITING_ACCEPTANCE,
      idempotency,
    })
    tx.ticketAttachment.count.mockResolvedValue(1)
    mockResolveAccess.mockResolvedValue(makeAccess())

    await svc.submitAcceptance(PROVIDER_ID, { id: USER_ID }, UserRole.ADMIN, TICKET_ID, {
      failureCauseId: 'cause-1',
      comment: 'Done',
    }, undefined, 'stable-key')

    expect(idempotency.run).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: PROVIDER_ID,
        userId: USER_ID,
        operationType: 'ticket_submit_acceptance',
        key: 'stable-key',
      }),
      expect.any(String),
      expect.any(Object),
    )
    expect(tx.ticketFailureCauseAssessment.create).toHaveBeenCalledTimes(1)
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
      ticketComment: {
        create: jest.fn().mockResolvedValue({ id: 'tc-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
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

  it('rejects forbidden comment before ticket mutation', async () => {
    const { svc, prisma } = makeCommentSetup({ isExecutor: true })
    mockResolveAccess.mockRejectedValue(new NotFoundException('Ticket not found'))

    await expect(
      svc.addComment(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, { comment: 'Done' }),
    ).rejects.toBeInstanceOf(NotFoundException)

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects empty comment (BadRequestException)', async () => {
    const { svc } = makeCommentSetup()

    await expect(
      svc.addComment(CLIENT_ID, { id: USER_ID }, UserRole.CLIENT, TICKET_ID, { comment: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(mockResolveAccess).not.toHaveBeenCalled()
  })
})
