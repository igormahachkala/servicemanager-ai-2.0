import { ServiceContractRole, ServiceContractStatus, TicketStatus, UserRole } from '@prisma/client'

import { AnalyticsService } from './analytics.service'

/**
 * SMA-TICKET-LIFECYCLE-TIME-ANALYTICS-108A.
 *
 * Проверяется агрегирующий слой: группировки, фильтры, SLA и — главное —
 * что доступ берётся из общего канонического резолвера, а не считается заново.
 */

const MIN = 60_000
const HOUR = 60 * MIN

function history(base: string, offsets: Array<[TicketStatus | null, TicketStatus, number]>) {
  const start = new Date(base).getTime()
  return offsets.map(([fromStatus, toStatus, minutes]) => ({
    fromStatus,
    toStatus,
    createdAt: new Date(start + minutes * MIN),
  }))
}

/** Заявка полного цикла: назначение +15м, работа +120м, приёмка +180м, принята +300м. */
function fullTicket(overrides: Record<string, any> = {}) {
  const createdAt = new Date('2026-09-01T10:00:00Z')
  return {
    id: overrides.id ?? 'tk-1',
    createdAt,
    closedAt: new Date('2026-09-01T15:00:00Z'),
    slaMinutes: 240,
    slaBreachedAt: null,
    problemCategoryId: 'cat-1',
    problemCategory: { id: 'cat-1', name: 'Электрика' },
    locationId: 'loc-1',
    location: { id: 'loc-1', name: 'Фудзияма Менделеева', city: 'Уфа' },
    assignedTechnicianId: 'tech-1',
    assignedTechnician: {
      id: 'tech-1',
      firstName: 'Иван',
      lastName: 'Иванов',
      email: 'tech1@example.test',
      companyId: 'provider-1',
    },
    statusHistory: history('2026-09-01T10:00:00Z', [
      [null, TicketStatus.NEW, 0],
      [TicketStatus.NEW, TicketStatus.ASSIGNED, 15],
      [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, 120],
      [TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_ACCEPTANCE, 180],
      [TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.DONE, 300],
    ]),
    ...overrides,
  }
}

function makeService(tickets: any[], options: { access?: any } = {}) {
  const prisma = {
    company: {
      findUnique: jest.fn().mockResolvedValue({ id: 'client-1', name: 'Клиент' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'provider-1', name: 'Подрядчик А' }]),
    },
    ticket: { findMany: jest.fn().mockResolvedValue(tickets) },
  } as any
  const contracts = {
    getLinkedClientAccess: jest.fn().mockResolvedValue(
      options.access ?? { status: ServiceContractStatus.ACTIVE, role: ServiceContractRole.PRIMARY },
    ),
  } as any
  const service = new AnalyticsService(prisma, {} as any, contracts)
  // Доступ разрешается общим резолвером аналитики; здесь он подменяется, чтобы
  // тест проверял агрегацию, а не переписывал правила доступа.
  const scopedWhere = { companyId: 'client-1' }
  const resolveScopedTicketWhere = jest
    .spyOn(service as any, 'resolveScopedTicketWhere')
    .mockResolvedValue(scopedWhere)
  jest.spyOn(service as any, 'resolveLocationScope').mockResolvedValue({ mode: 'tenant_wide', locationIds: [] })
  return { service, prisma, contracts, resolveScopedTicketWhere }
}

function call(
  service: AnalyticsService,
  params: Record<string, any> = {},
  actorCompanyId = 'client-1',
) {
  return service.getTicketLifecycleAnalytics(actorCompanyId, 'user-1', UserRole.ADMIN, params)
}

describe('AnalyticsService.getTicketLifecycleAnalytics', () => {
  beforeEach(() => jest.clearAllMocks())

  it('считает общие метрики по выборке', async () => {
    const { service } = makeService([fullTicket()])

    const result = await call(service)

    expect(result.overall.tickets).toBe(1)
    expect(result.overall.timeToAssignment.averageMs).toBe(15 * MIN)
    expect(result.overall.workCycleTime.averageMs).toBe(HOUR)
    expect(result.overall.acceptanceWaitTime.averageMs).toBe(2 * HOUR)
    expect(result.overall.totalLifecycleTime.medianMs).toBe(5 * HOUR)
  })

  it('15/16/17: доступ берётся из канонического резолвера, своего не строится', async () => {
    const { service, prisma, resolveScopedTicketWhere } = makeService([fullTicket()])

    await call(service, { linkedClientCompanyId: 'client-1' })

    expect(resolveScopedTicketWhere).toHaveBeenCalledTimes(1)
    // Итоговый where обязан содержать результат резолвера, а не собственный фильтр.
    const where = prisma.ticket.findMany.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain('client-1')
  })

  it('17: SECONDARY-контур проходит тот же путь разрешения', async () => {
    const { service, contracts } = makeService([fullTicket()], {
      access: { status: ServiceContractStatus.ACTIVE, role: ServiceContractRole.SECONDARY },
    })

    // Актор — подрядчик, контур — чужой клиент: только тогда путь идёт через договор.
    const result = await call(service, { linkedClientCompanyId: 'client-1' }, 'provider-1')

    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith('provider-1', 'client-1')
    expect(result.scope.visibilityMode).toBe('provider_secondary')
  })

  it('10: группировка по категории', async () => {
    const { service } = makeService([
      fullTicket(),
      fullTicket({
        id: 'tk-2',
        problemCategoryId: 'cat-2',
        problemCategory: { id: 'cat-2', name: 'Сантехника' },
      }),
    ])

    const result = await call(service, { groupBy: 'category' })

    expect(result.groupBy).toBe('category')
    expect(result.groups.map((g) => g.label).sort()).toEqual(['Сантехника', 'Электрика'])
    expect(result.groups.every((g) => g.tickets === 1)).toBe(true)
  })

  it('11: группировка по городу, заявки без города собираются отдельно', async () => {
    const { service } = makeService([
      fullTicket(),
      fullTicket({ id: 'tk-2', location: { id: 'loc-2', name: 'Точка', city: null } }),
    ])

    const result = await call(service, { groupBy: 'city' })

    expect(result.groups.map((g) => g.label).sort()).toEqual(['Без города', 'Уфа'])
  })

  it('12: группировка по точке', async () => {
    const { service } = makeService([fullTicket()])
    const result = await call(service, { groupBy: 'location' })
    expect(result.groups[0].label).toBe('Фудзияма Менделеева')
  })

  it('13: группировка по сотруднику, неназначенные — отдельной группой', async () => {
    const { service } = makeService([
      fullTicket(),
      fullTicket({ id: 'tk-2', assignedTechnicianId: null, assignedTechnician: null }),
    ])

    const result = await call(service, { groupBy: 'assignee' })

    expect(result.groups.map((g) => g.label).sort()).toEqual(['Иванов Иван', 'Не назначен'])
  })

  it('группировка по подрядчику подставляет название компании', async () => {
    const { service, prisma } = makeService([fullTicket()])
    prisma.company.findMany = jest.fn().mockResolvedValue([{ id: 'provider-1', name: 'Подрядчик А' }])

    const result = await call(service, { groupBy: 'provider' })

    expect(result.groups[0].label).toBe('Подрядчик А')
  })

  it('неизвестная группировка не роняет запрос и трактуется как none', async () => {
    const { service } = makeService([fullTicket()])
    const result = await call(service, { groupBy: 'nonsense' })
    expect(result.groupBy).toBe('none')
    expect(result.groups).toEqual([])
  })

  it('14: фильтр периода уходит в запрос, а не отсекается в памяти', async () => {
    const { service, prisma } = makeService([fullTicket()])

    await call(service, { from: '2026-09-01', to: '2026-09-30' })

    const where = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    expect(where).toContain('createdAt')
  })

  it('фильтры по точке, категории, городу и исполнителю доходят до запроса', async () => {
    const { service, prisma } = makeService([fullTicket()])

    await call(service, {
      locationId: 'loc-1',
      categoryId: 'cat-1',
      city: 'Уфа',
      assigneeId: 'tech-1',
    })

    const where = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    for (const expected of ['loc-1', 'cat-1', 'Уфа', 'tech-1']) {
      expect(where).toContain(expected)
    }
  })

  it('SLA берётся канонический и не пересчитывается', async () => {
    const { service } = makeService([
      fullTicket(),
      fullTicket({ id: 'tk-2', slaBreachedAt: new Date('2026-09-01T20:00:00Z') }),
    ])

    const result = await call(service)

    expect(result.sla.trackedTickets).toBe(2)
    expect(result.sla.breachedTickets).toBe(1)
    expect(result.sla.withinSlaRate).toBe(50)
  })

  it('19: пустая выборка возвращает нули, а не падает', async () => {
    const { service } = makeService([])

    const result = await call(service, { groupBy: 'category' })

    expect(result.overall.tickets).toBe(0)
    expect(result.overall.totalLifecycleTime.averageMs).toBeNull()
    expect(result.groups).toEqual([])
    expect(result.sla.withinSlaRate).toBeNull()
  })

  it('календарное время не выдаётся за трудозатраты техника', async () => {
    const { service } = makeService([fullTicket()])
    const result = await call(service)
    expect(result.labor).toEqual({
      source: 'WorkLog',
      available: false,
      reason: 'work_logs_not_recorded',
    })
  })

  it('агрегация идёт на бэкенде: наружу отдаются сводки, а не сырые заявки', async () => {
    const { service } = makeService([fullTicket()])
    const result = await call(service) as any
    expect(result.tickets).toBeUndefined()
    expect(Array.isArray(result.groups)).toBe(true)
  })
})
