import { TicketStatus, UserRole } from '@prisma/client'

import { TicketsStatusService } from './tickets.status.service'
import { TicketsAcceptanceService } from './tickets.acceptance.service'
import * as ticketAccessUtils from './ticket-access.utils'
import * as ticketAcceptanceAccess from './ticket-acceptance-access'
import { AcceptanceDecision } from './dto/ticket-acceptance.dto'

jest.mock('./ticket-access.utils', () => ({
  resolveTicketOperationAccess: jest.fn(),
}))

jest.mock('./ticket-acceptance-access', () => ({
  resolveTicketAcceptanceAccess: jest.fn(),
}))

const mockResolveOperationAccess = ticketAccessUtils.resolveTicketOperationAccess as jest.MockedFunction<
  typeof ticketAccessUtils.resolveTicketOperationAccess
>
const mockResolveAcceptanceAccess = ticketAcceptanceAccess.resolveTicketAcceptanceAccess as jest.MockedFunction<
  typeof ticketAcceptanceAccess.resolveTicketAcceptanceAccess
>

const CLIENT_ID = 'client-1'
const PROVIDER_ID = 'provider-1'
const TICKET_ID = 'ticket-1'
const TECH_ID = 'tech-1'
const CLIENT_ADMIN_ID = 'client-admin-1'

describe('Failure cause assessment acceptance cycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates an immutable assessment for each real submit after rejection', async () => {
    const state = {
      ticket: {
        id: TICKET_ID,
        companyId: CLIENT_ID,
        status: TicketStatus.IN_PROGRESS,
        assignedTechnicianId: TECH_ID,
        createdByUserId: 'requester-1',
        assignedTechnician: { id: TECH_ID, companyId: PROVIDER_ID },
        slaDueAt: null,
        slaBreachedAt: null,
        closedAt: null,
        ticketNumber: 7001,
        problemText: 'Не охлаждает',
        locationId: 'loc-1',
      },
      histories: [] as Array<any>,
      assessments: [] as Array<any>,
      events: [] as Array<any>,
    }
    const causes = new Map([
      ['cause-a', { id: 'cause-a', name: 'Износ', companyId: CLIENT_ID, active: true }],
      ['cause-b', { id: 'cause-b', name: 'Ошибка эксплуатации', companyId: CLIENT_ID, active: true }],
    ])

    const tx = {
      ticket: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.id !== TICKET_ID || where.companyId !== CLIENT_ID) return null
          return { ...state.ticket }
        }),
        update: jest.fn(async ({ data }: any) => {
          state.ticket = { ...state.ticket, ...data }
          return { ...state.ticket }
        }),
      },
      failureCause: {
        findFirst: jest.fn(async ({ where }: any) => {
          const cause = causes.get(where.id)
          if (!cause || cause.companyId !== where.companyId || cause.active !== where.active) return null
          return { id: cause.id, name: cause.name }
        }),
      },
      ticketAttachment: {
        count: jest.fn(async () => 1),
        findMany: jest.fn(async () => []),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      domainEvent: { count: jest.fn(async () => 0) },
      ticketStatusHistory: {
        count: jest.fn(async () => 0),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `history-${state.histories.length + 1}`, ...data }
          state.histories.push(row)
          return row
        }),
      },
      ticketFailureCauseAssessment: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `assessment-${state.assessments.length + 1}`, ...data }
          state.assessments.push(row)
          return row
        }),
      },
    }
    const prisma = {
      company: {
        findUnique: jest.fn(async () => ({ id: PROVIDER_ID, type: 'PROVIDER' })),
      },
      user: {
        findFirst: jest.fn(async () => ({ isExecutor: true })),
        findUnique: jest.fn(async () => ({ companyId: PROVIDER_ID })),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    } as any
    const timeline = {
      recordTx: jest.fn(async (_tx: any, event: any) => {
        const row = { id: `event-${state.events.length + 1}`, ...event }
        state.events.push(row)
        return row
      }),
    }
    const notifications = {
      scheduleTicketStatusChanged: jest.fn(),
      scheduleTicketStatusAssignee: jest.fn(),
      scheduleTicketCommentAdded: jest.fn(),
      onTicketInProgress: jest.fn(),
      onTicketDone: jest.fn(),
      onTicketAwaitingAcceptance: jest.fn(),
      onTicketAccepted: jest.fn(),
      onTicketRejected: jest.fn(),
    }
    const serviceContracts = {}
    const statusSvc = new TicketsStatusService(
      prisma,
      timeline as any,
      serviceContracts as any,
      notifications as any,
    )
    const acceptanceSvc = new TicketsAcceptanceService(
      prisma,
      timeline as any,
      serviceContracts as any,
      notifications as any,
    )

    mockResolveOperationAccess.mockResolvedValue({
      ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: TECH_ID },
      scopeCompanyId: CLIENT_ID,
      operationCompanyId: PROVIDER_ID,
      visibilityMode: 'provider_primary',
    } as any)
    mockResolveAcceptanceAccess.mockResolvedValue({
      actor: { id: CLIENT_ADMIN_ID, companyId: CLIENT_ID, role: UserRole.ADMIN, isActive: true },
      ticket: {
        id: TICKET_ID,
        companyId: CLIENT_ID,
        assignedTechnicianId: TECH_ID,
        createdByUserId: 'requester-1',
        assignedTechnician: { id: TECH_ID, companyId: PROVIDER_ID },
      },
      scopeCompanyId: CLIENT_ID,
      visibilityMode: 'tenant',
      reason: 'client_management',
    } as any)

    await statusSvc.submitAcceptance(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, {
      failureCauseId: 'cause-a',
      comment: 'Первая отправка',
    })
    expect(state.ticket.status).toBe(TicketStatus.AWAITING_ACCEPTANCE)

    await acceptanceSvc.decide(
      { id: CLIENT_ADMIN_ID, role: UserRole.ADMIN, companyId: CLIENT_ID },
      TICKET_ID,
      { decision: AcceptanceDecision.REJECT, comment: 'Нужна доработка' },
    )
    expect(state.ticket.status).toBe(TicketStatus.IN_PROGRESS)

    await statusSvc.submitAcceptance(PROVIDER_ID, { id: TECH_ID }, UserRole.TECHNICIAN, TICKET_ID, {
      failureCauseId: 'cause-b',
      comment: 'Повторная отправка',
    })

    const awaitingHistories = state.histories.filter((row) => row.toStatus === TicketStatus.AWAITING_ACCEPTANCE)
    expect(awaitingHistories).toHaveLength(2)
    expect(state.histories).toEqual([
      expect.objectContaining({
        id: 'history-1',
        fromStatus: TicketStatus.IN_PROGRESS,
        toStatus: TicketStatus.AWAITING_ACCEPTANCE,
      }),
      expect.objectContaining({
        id: 'history-2',
        fromStatus: TicketStatus.AWAITING_ACCEPTANCE,
        toStatus: TicketStatus.IN_PROGRESS,
      }),
      expect.objectContaining({
        id: 'history-3',
        fromStatus: TicketStatus.IN_PROGRESS,
        toStatus: TicketStatus.AWAITING_ACCEPTANCE,
      }),
    ])
    expect(state.assessments).toEqual([
      expect.objectContaining({
        ticketStatusHistoryId: 'history-1',
        failureCauseId: 'cause-a',
        failureCauseNameSnapshot: 'Износ',
      }),
      expect.objectContaining({
        ticketStatusHistoryId: 'history-3',
        failureCauseId: 'cause-b',
        failureCauseNameSnapshot: 'Ошибка эксплуатации',
      }),
    ])
    expect(state.assessments[0].failureCauseNameSnapshot).toBe('Износ')
    expect(state.assessments[1].failureCauseNameSnapshot).toBe('Ошибка эксплуатации')
  })
})
