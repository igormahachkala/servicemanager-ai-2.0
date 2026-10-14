import { TicketStatus, TicketUrgency, UserRole, WorkLogStatus, WorkShiftStatus } from '@prisma/client'

import { REASON_LABELS } from './planner.scoring'
import { PlannerService } from './planner.service'

const TECH_ID = 'tech-1'
const PROVIDER_ID = 'provider-1'
const CLIENT_A = 'client-a'
const CLIENT_B = 'client-b'
const LOC_A = 'loc-a'
const LOC_B = 'loc-b'
const SHIFT_ID = 'shift-1'

function boardWithCards(cards: any[]) {
  const byStatus = new Map<TicketStatus, any[]>()
  for (const card of cards) {
    const list = byStatus.get(card.status) ?? []
    list.push(card)
    byStatus.set(card.status, list)
  }
  return {
    columns: [...byStatus.entries()].map(([status, statusCards]) => ({
      status,
      cards: statusCards,
      total: statusCards.length,
      sla: { breached: 0, atRisk: 0 },
    })),
    meta: {},
  }
}

function ticketCard(partial: Record<string, unknown>) {
  return {
    id: 't-1',
    status: TicketStatus.ASSIGNED,
    urgency: TicketUrgency.NOT_URGENT,
    slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    title: 'Категория',
    description: 'Текст',
    assignedTechnicianId: TECH_ID,
    company: { id: CLIENT_A, name: 'Клиент А' },
    location: { id: LOC_A, name: 'Площадка А', city: 'Город', address: 'ул. 1' },
    ...partial,
  }
}

function makeService(overrides?: {
  openShift?: { id: string } | null
  lastWorkLogLocationId?: string | null
  contexts?: any[]
  boardByLinkedClient?: Map<string | undefined, any>
  board?: any
  schedules?: any[]
  domainEvents?: any[]
}) {
  const domainEventFindMany = jest.fn(async () => overrides?.domainEvents ?? [])
  const prisma = {
    workShift: {
      findFirst: jest.fn(async () =>
        overrides && 'openShift' in overrides ? overrides.openShift : { id: SHIFT_ID },
      ),
    },
    workLog: {
      findFirst: jest.fn(async () =>
        overrides?.lastWorkLogLocationId
          ? { ticket: { locationId: overrides.lastWorkLogLocationId } }
          : null,
      ),
    },
    domainEvent: {
      findMany: domainEventFindMany,
    },
  }

  const boardByLinkedClient = overrides?.boardByLinkedClient
  const ticketsQuery = {
    board: jest.fn(async (_c: string, _u: string, _r: UserRole, _i: unknown, _a: unknown, linked?: string) => {
      if (boardByLinkedClient) {
        return boardByLinkedClient.get(linked) ?? boardWithCards([])
      }
      return overrides?.board ?? boardWithCards([])
    }),
  }

  const technicians = {
    getBoundContexts: jest.fn(async () => overrides?.contexts ?? []),
  }

  const schedules = {
    list: jest.fn(async () => overrides?.schedules ?? []),
  }

  const service = new PlannerService(
    prisma as any,
    ticketsQuery as any,
    technicians as any,
    schedules as any,
  )

  return { service, prisma, ticketsQuery, technicians, schedules, domainEventFindMany }
}

const actor = {
  companyId: PROVIDER_ID,
  userId: TECH_ID,
  role: UserRole.TECHNICIAN,
  accessFlags: {},
}

describe('PlannerService.getMyNext', () => {
  it('без открытой смены отдаёт shiftOpen false', async () => {
    const { service, ticketsQuery, technicians, schedules } = makeService({ openShift: null })
    await expect(service.getMyNext(actor)).resolves.toEqual({ shiftOpen: false })
    expect(ticketsQuery.board).not.toHaveBeenCalled()
    expect(technicians.getBoundContexts).not.toHaveBeenCalled()
    expect(schedules.list).not.toHaveBeenCalled()
  })

  it('заявка чужого контура не попадает, если board её не вернул', async () => {
    const boardByLinkedClient = new Map<string | undefined, any>([
      [
        CLIENT_A,
        boardWithCards([
          ticketCard({
            id: 'mine',
            status: TicketStatus.ASSIGNED,
            assignedTechnicianId: TECH_ID,
            company: { id: CLIENT_A, name: 'Клиент А' },
            location: { id: LOC_A, name: 'А', city: null, address: 'a' },
          }),
        ]),
      ],
      // CLIENT_B bound, but board returns empty — foreign ticket never appears
      [CLIENT_B, boardWithCards([])],
    ])

    const { service } = makeService({
      contexts: [
        { clientCompany: { id: CLIENT_A, name: 'Клиент А' } },
        { clientCompany: { id: CLIENT_B, name: 'Клиент Б' } },
      ],
      boardByLinkedClient,
      domainEvents: [],
    })

    const result = await service.getMyNext(actor)
    expect(result.shiftOpen).toBe(true)
    if (!result.shiftOpen) return
    const ticketIds = (result.first?.works ?? [])
      .concat(result.next.flatMap((o) => o.works))
      .filter((w) => w.kind === 'TICKET')
      .map((w) => w.ticketId)
    expect(ticketIds).toEqual(['mine'])
    expect(ticketIds).not.toContain('foreign')
  })

  it('назначенная на другого техника не попадает в пул', async () => {
    const { service } = makeService({
      contexts: [{ clientCompany: { id: CLIENT_A, name: 'Клиент А' } }],
      board: boardWithCards([
        ticketCard({
          id: 'other-tech',
          status: TicketStatus.ASSIGNED,
          assignedTechnicianId: 'someone-else',
        }),
        ticketCard({
          id: 'mine',
          status: TicketStatus.ASSIGNED,
          assignedTechnicianId: TECH_ID,
          location: { id: LOC_B, name: 'Б', city: null, address: 'b' },
        }),
      ]),
      domainEvents: [],
    })

    const result = await service.getMyNext(actor)
    expect(result.shiftOpen).toBe(true)
    if (!result.shiftOpen) return
    const ids = [result.first, ...result.next]
      .filter(Boolean)
      .flatMap((o) => o!.works)
      .map((w) => w.id)
    expect(ids).toContain('mine')
    expect(ids).not.toContain('other-tech')
  })

  it('IN_PROGRESS техника задаёт currentLocationId и даёт «Вы уже здесь»', async () => {
    const dueSoon = new Date(Date.now() + 60 * 60 * 1000)
    const { service } = makeService({
      contexts: [{ clientCompany: { id: CLIENT_A, name: 'Клиент А' } }],
      board: boardWithCards([
        ticketCard({
          id: 'in-progress',
          status: TicketStatus.IN_PROGRESS,
          assignedTechnicianId: TECH_ID,
          location: { id: LOC_A, name: 'А', city: null, address: 'a' },
        }),
        ticketCard({
          id: 'next-here',
          status: TicketStatus.ASSIGNED,
          assignedTechnicianId: TECH_ID,
          urgency: TicketUrgency.NOT_URGENT,
          slaDueAt: dueSoon,
          location: { id: LOC_A, name: 'А', city: null, address: 'a' },
        }),
        ticketCard({
          id: 'elsewhere',
          status: TicketStatus.ASSIGNED,
          assignedTechnicianId: TECH_ID,
          urgency: TicketUrgency.NOT_URGENT,
          slaDueAt: dueSoon,
          location: { id: LOC_B, name: 'Б', city: null, address: 'b' },
        }),
      ]),
      domainEvents: [],
    })

    const result = await service.getMyNext(actor)
    expect(result.shiftOpen).toBe(true)
    if (!result.shiftOpen) return
    expect(result.currentLocationId).toBe(LOC_A)
    expect(result.first?.locationId).toBe(LOC_A)
    expect(result.first?.reasons.some((r) => r.label === REASON_LABELS.ALREADY_HERE)).toBe(true)
    const poolIds = [result.first, ...result.next]
      .filter(Boolean)
      .flatMap((o) => o!.works)
      .map((w) => w.id)
    expect(poolIds).not.toContain('in-progress')
  })

  it('dispatcherAssigned: auto и claim без признака, manual и reassign с признаком; события одним findMany', async () => {
    const cards = [
      ticketCard({ id: 'auto-t', status: TicketStatus.ASSIGNED, assignedTechnicianId: TECH_ID, location: { id: LOC_A, name: 'А', city: null, address: 'a' } }),
      ticketCard({ id: 'claim-t', status: TicketStatus.ASSIGNED, assignedTechnicianId: TECH_ID, location: { id: LOC_A, name: 'А', city: null, address: 'a' } }),
      ticketCard({ id: 'manual-t', status: TicketStatus.ASSIGNED, assignedTechnicianId: TECH_ID, location: { id: LOC_B, name: 'Б', city: null, address: 'b' } }),
      ticketCard({ id: 'reassign-t', status: TicketStatus.ASSIGNED, assignedTechnicianId: TECH_ID, location: { id: LOC_B, name: 'Б', city: null, address: 'b' } }),
    ]

    const { service, domainEventFindMany } = makeService({
      contexts: [{ clientCompany: { id: CLIENT_A, name: 'Клиент А' } }],
      board: boardWithCards(cards),
      domainEvents: [
        // newest first overall — service groups by entityId taking first seen
        {
          entityId: 'reassign-t',
          actorUserId: 'dispatcher-1',
          createdAt: new Date('2026-10-14T12:00:00.000Z'),
          payload: { mode: 'reassign', assignedTechnicianId: TECH_ID },
        },
        {
          entityId: 'reassign-t',
          actorUserId: 'dispatcher-1',
          createdAt: new Date('2026-10-14T11:00:00.000Z'),
          payload: { mode: 'manual', assignedTechnicianId: 'other' },
        },
        {
          entityId: 'manual-t',
          actorUserId: 'dispatcher-1',
          createdAt: new Date('2026-10-14T10:00:00.000Z'),
          payload: { mode: 'manual', assignedTechnicianId: TECH_ID },
        },
        {
          entityId: 'auto-t',
          actorUserId: null,
          createdAt: new Date('2026-10-14T09:00:00.000Z'),
          payload: { mode: 'auto', assignedTechnicianId: TECH_ID },
        },
        {
          entityId: 'claim-t',
          actorUserId: TECH_ID,
          createdAt: new Date('2026-10-14T08:00:00.000Z'),
          payload: { mode: 'claim', assignedTechnicianId: TECH_ID },
        },
      ],
    })

    const result = await service.getMyNext(actor)
    expect(result.shiftOpen).toBe(true)
    if (!result.shiftOpen) return

    expect(domainEventFindMany).toHaveBeenCalledTimes(1)
    const findArg = domainEventFindMany.mock.calls[0][0]
    expect(findArg.where.entityType).toBe('Ticket')
    expect(findArg.where.type).toBe('ticket.assigned')
    expect(findArg.where.entityId.in.sort()).toEqual(
      ['auto-t', 'claim-t', 'manual-t', 'reassign-t'].sort(),
    )

    const works = [result.first, ...result.next].filter(Boolean).flatMap((o) => o!.works)
    const byId = new Map(works.map((w) => [w.id, w]))

    expect(byId.get('auto-t')?.dispatcherAssigned).toBe(false)
    expect(byId.get('auto-t')?.reasons.some((r) => r.label === REASON_LABELS.DISPATCHER_ASSIGNED)).toBe(
      false,
    )
    expect(byId.get('claim-t')?.dispatcherAssigned).toBe(false)
    expect(byId.get('manual-t')?.dispatcherAssigned).toBe(true)
    expect(byId.get('manual-t')?.reasons.some((r) => r.label === REASON_LABELS.DISPATCHER_ASSIGNED)).toBe(
      true,
    )
    expect(byId.get('reassign-t')?.dispatcherAssigned).toBe(true)
    expect(
      byId.get('reassign-t')?.reasons.some((r) => r.label === REASON_LABELS.DISPATCHER_ASSIGNED),
    ).toBe(true)
  })

  it('пустой список контуров — один вызов board без linkedClientCompanyId', async () => {
    const { service, ticketsQuery } = makeService({
      contexts: [],
      board: boardWithCards([]),
    })
    await service.getMyNext(actor)
    expect(ticketsQuery.board).toHaveBeenCalledTimes(1)
    expect(ticketsQuery.board.mock.calls[0][5]).toBeUndefined()
  })

  it('currentLocationId из последнего закрытого WorkLog, если нет IN_PROGRESS', async () => {
    const { service, prisma } = makeService({
      contexts: [{ clientCompany: { id: CLIENT_A, name: 'Клиент А' } }],
      board: boardWithCards([
        ticketCard({
          id: 'assigned',
          status: TicketStatus.ASSIGNED,
          assignedTechnicianId: TECH_ID,
          location: { id: LOC_B, name: 'Б', city: null, address: 'b' },
        }),
      ]),
      lastWorkLogLocationId: LOC_A,
      domainEvents: [],
    })

    const result = await service.getMyNext(actor)
    expect(result.shiftOpen).toBe(true)
    if (!result.shiftOpen) return
    expect(result.currentLocationId).toBe(LOC_A)
    expect(prisma.workLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shiftId: SHIFT_ID,
          status: { in: [WorkLogStatus.STOPPED, WorkLogStatus.AUTO_STOPPED] },
        }),
      }),
    )
    expect(prisma.workShift.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: WorkShiftStatus.OPEN }),
      }),
    )
  })
})
