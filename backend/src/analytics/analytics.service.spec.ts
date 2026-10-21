import { BadRequestException } from '@nestjs/common'
import { ServiceContractRole, ServiceContractStatus, TicketStatus, UserAccessLocationMode, UserRole } from '@prisma/client'

import { AnalyticsService } from './analytics.service'

describe('AnalyticsService provider linked-client scope', () => {
  function makeService(access: any) {
    const prisma = {
      company: {
        findUnique: jest.fn(),
      },
    }
    const timeline = {}
    const contracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue(access),
    }
    return {
      service: new AnalyticsService(prisma as any, timeline as any, contracts as any),
      contracts,
    }
  }

  it('allows PRIMARY linked-client analytics scope', async () => {
    const { service } = makeService({
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.PRIMARY,
    })

    await expect((service as any).resolveScope(
      'provider-company',
      UserRole.ADMIN,
      undefined,
      'client-company',
    )).resolves.toEqual({
      scopeCompanyId: 'client-company',
      visibilityMode: 'provider_primary',
    })
  })

  it('allows SECONDARY linked-client analytics scope without tenant-wide fallback', async () => {
    const { service } = makeService({
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.SECONDARY,
    })

    await expect((service as any).resolveScope(
      'provider-company',
      UserRole.MASTER,
      undefined,
      'client-company',
    )).resolves.toEqual({
      scopeCompanyId: 'client-company',
      visibilityMode: 'provider_secondary',
    })
  })

  it('rejects linked-client analytics when no active contract exists', async () => {
    const { service } = makeService(null)

    await expect((service as any).resolveScope(
      'provider-company',
      UserRole.ADMIN,
      undefined,
      'client-company',
    )).rejects.toBeInstanceOf(BadRequestException)
  })

  it('fail-closes location analytics for provider ADMIN with SELECTED_LOCATIONS and no bindings', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      },
      userAccessScope: {
        findUnique: jest.fn().mockResolvedValue({
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        }),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      location: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      problemCategory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ticket: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        // Phase 2: источник времён для SLA.
        findMany: jest.fn().mockResolvedValue([]),
      },
      ticketStatusHistory: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
    }
    const contracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        status: ServiceContractStatus.ACTIVE,
        role: ServiceContractRole.PRIMARY,
      }),
    }
    const service = new AnalyticsService(prisma as any, {} as any, contracts as any)

    const result = await service.getLocationsAnalytics(
      'provider-company',
      'admin-1',
      UserRole.ADMIN,
      { linkedClientCompanyId: 'client-company', locationId: 'loc-forbidden' },
    )

    expect(result.summary.totalTickets).toBe(0)
    expect(prisma.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: { equals: '__no_access__' } }),
          ]),
        }),
      }),
    )
    expect(JSON.stringify(prisma.ticket.groupBy.mock.calls[0][0].where)).toContain('__no_access__')
    expect(JSON.stringify(prisma.ticket.groupBy.mock.calls[0][0].where)).toContain('loc-forbidden')

    /*
     * Phase 2: источники SLA обязаны идти по ТОЙ ЖЕ области. Если бы они
     * ходили по собственному where, fail-closed обходился бы через аналитику
     * SLA — поэтому проверяется каждый из двух новых запросов.
     */
    const slaWhere = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    expect(slaWhere).toContain('__no_access__')
    expect(slaWhere).toContain('loc-forbidden')

    const historyCall = prisma.ticketStatusHistory.groupBy.mock.calls[0][0]
    expect(historyCall.where.toStatus).toEqual({
      in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
    })
    const historyWhere = JSON.stringify(historyCall.where.ticket)
    expect(historyWhere).toContain('__no_access__')
    expect(historyWhere).toContain('loc-forbidden')

    expect(result.cityGroups).toEqual([])
    expect(result.summary.sla.slaBreaches).toBe(0)
    expect(result.summary.sla.withinSlaRatio).toBeNull()
  })
})

/**
 * SMA-ANALYTICS-V2-PHASE2 — поведение A1/A2/A3 на уровне сервиса.
 *
 * Чистые формулы проверены в analytics-aggregates.spec.ts. Здесь проверяется
 * сборка: что флаг A2 действительно меняет состав строк, что городские суммы
 * сходятся с summary и что SLA попадает в строки, города и организацию.
 */
describe('AnalyticsService Phase 2: города, пустые точки, SLA', () => {
  const CLIENT = 'client-company'

  function buildPrisma(options: {
    locations: Array<{ id: string; name: string; city: string | null }>
    statusRows: Array<{ locationId: string; status: TicketStatus; count: number }>
    overdueRows?: Array<{ locationId: string; count: number }>
    slaTickets?: Array<{
      id: string
      locationId: string
      status?: TicketStatus
      createdAt: Date
      closedAt: Date | null
      slaDueAt: Date | null
      slaBreachedAt: Date | null
    }>
    firstAssigned?: Array<{ ticketId: string; createdAt: Date }>
    /** История статусов: мок фильтрует её по where.toStatus, как сделала бы БД. */
    statusHistory?: Array<{ ticketId: string; toStatus: TicketStatus; createdAt: Date }>
    summaryTotal?: number
  }) {
    const statusGroupBy = options.statusRows.map((row) => ({
      locationId: row.locationId,
      status: row.status,
      _count: { _all: row.count },
    }))
    const overdueGroupBy = (options.overdueRows ?? []).map((row) => ({
      locationId: row.locationId,
      _count: { _all: row.count },
    }))
    const summaryTotal =
      options.summaryTotal ?? options.statusRows.reduce((sum, row) => sum + row.count, 0)

    return {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin-1' }) },
      userAccessScope: { findUnique: jest.fn().mockResolvedValue(null) },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
      location: { findMany: jest.fn().mockResolvedValue(options.locations) },
      problemCategory: { findMany: jest.fn().mockResolvedValue([]) },
      ticket: {
        // Порядок вызовов повторяет Promise.all в сервисе.
        groupBy: jest
          .fn()
          .mockResolvedValueOnce(statusGroupBy) // byLocationStatus
          .mockResolvedValueOnce([]) // byLocationCategory
          .mockResolvedValueOnce(overdueGroupBy) // overdueByLocation
          .mockResolvedValueOnce([]), // overdueByLocationCategory
        count: jest
          .fn()
          .mockResolvedValueOnce(summaryTotal)
          .mockResolvedValueOnce((options.overdueRows ?? []).reduce((s, r) => s + r.count, 0)),
        findMany: jest
          .fn()
          .mockResolvedValue(
            (options.slaTickets ?? []).map((row) => ({ status: TicketStatus.DONE, ...row })),
          ),
      },
      ticketStatusHistory: {
        groupBy: jest.fn(async ({ where }: any) => {
          const history = [
            ...(options.firstAssigned ?? []).map((row) => ({ ...row, toStatus: TicketStatus.ASSIGNED })),
            ...(options.statusHistory ?? []),
          ]
          const wanted: TicketStatus[] =
            typeof where.toStatus === 'string' ? [where.toStatus] : where.toStatus.in
          const first = new Map<string, Date>()
          for (const row of history) {
            if (!wanted.includes(row.toStatus)) continue
            const prev = first.get(row.ticketId)
            if (!prev || row.createdAt < prev) first.set(row.ticketId, row.createdAt)
          }
          return [...first].map(([ticketId, createdAt]) => ({ ticketId, _min: { createdAt } }))
        }),
      },
    }
  }

  function buildService(prisma: any) {
    return new AnalyticsService(prisma as any, {} as any, {
      getLinkedClientAccess: jest.fn(),
    } as any)
  }

  it('период ISO-моментом и категория только сужают выборку: область компании остаётся в where', async () => {
    const prisma = buildPrisma({
      locations: [{ id: 'busy', name: 'С заявками', city: 'Москва' }],
      statusRows: [{ locationId: 'busy', status: TicketStatus.NEW, count: 1 }],
    })
    await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {
      from: '2026-10-15T00:00:00.000+03:00',
      to: '2026-10-21T23:59:59.999+03:00',
      categoryId: 'cat-1',
    })

    const where = prisma.ticket.count.mock.calls[0][0].where
    expect(where.AND[0]).toEqual({ companyId: CLIENT })
    expect(where.AND[1].createdAt.gte.toISOString()).toBe('2026-10-14T21:00:00.000Z')
    expect(where.AND[1].createdAt.lte.toISOString()).toBe('2026-10-21T20:59:59.999Z')
    expect(where.AND[1].problemCategoryId).toBe('cat-1')
    // Те же where у SLA-выборки: заявки другой компании сюда не попадут.
    expect(prisma.ticket.findMany.mock.calls[0][0].where).toEqual(where)
  })

  it('A2: по умолчанию точка без заявок не показывается', async () => {
    const prisma = buildPrisma({
      locations: [
        { id: 'busy', name: 'С заявками', city: 'Москва' },
        { id: 'idle', name: 'Без заявок', city: 'Казань' },
      ],
      statusRows: [{ locationId: 'busy', status: TicketStatus.NEW, count: 3 }],
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {})

    expect(result.items.map((i) => i.locationId)).toEqual(['busy'])
    expect(result.summary.totalLocations).toBe(1)
  })

  it('A2: с флагом точка без заявок показывается с нулями', async () => {
    const prisma = buildPrisma({
      locations: [
        { id: 'busy', name: 'С заявками', city: 'Москва' },
        { id: 'idle', name: 'Без заявок', city: 'Казань' },
      ],
      statusRows: [{ locationId: 'busy', status: TicketStatus.NEW, count: 3 }],
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {
      includeEmptyLocations: true,
    })

    const idle = result.items.find((i) => i.locationId === 'idle')
    expect(idle).toBeDefined()
    expect(idle?.totalTickets).toBe(0)
    expect(idle?.overdueTickets).toBe(0)
    expect(idle?.sla.avgResolutionMinutes).toBeNull()
    expect(idle?.sla.withinSlaRatio).toBeNull()
    expect(result.summary.totalLocations).toBe(2)
  })

  it('A2: явный minTickets сильнее флага', async () => {
    const prisma = buildPrisma({
      locations: [
        { id: 'one', name: 'Одна', city: 'Москва' },
        { id: 'idle', name: 'Без заявок', city: 'Москва' },
      ],
      statusRows: [{ locationId: 'one', status: TicketStatus.NEW, count: 1 }],
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {
      includeEmptyLocations: true,
      minTickets: 2,
    })
    expect(result.items).toEqual([])
  })

  it('A1: города складываются из канонических счётчиков строк', async () => {
    const prisma = buildPrisma({
      locations: [
        { id: 'm1', name: 'М1', city: 'Москва' },
        { id: 'm2', name: 'М2', city: 'москва' },
        { id: 'k1', name: 'К1', city: 'Казань' },
      ],
      statusRows: [
        { locationId: 'm1', status: TicketStatus.NEW, count: 20 },
        { locationId: 'm2', status: TicketStatus.DONE, count: 14 },
        { locationId: 'k1', status: TicketStatus.NEW, count: 7 },
      ],
      overdueRows: [{ locationId: 'm1', count: 2 }],
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {})

    const moscow = result.cityGroups.find((c) => c.cityLabel === 'Москва')
    expect(moscow?.locationsCount).toBe(2)
    expect(moscow?.totalTickets).toBe(34)
    expect(moscow?.overdueTickets).toBe(2)
    expect(result.cityGroups.find((c) => c.cityLabel === 'Казань')?.totalTickets).toBe(7)
  })

  it('A1: сумма по городам плюс ticketsOutsideRows равна summary.totalTickets', async () => {
    // 27 заявок в строках, в области 30: три относятся к деактивированной точке.
    const prisma = buildPrisma({
      locations: [
        { id: 'm1', name: 'М1', city: 'Москва' },
        { id: 'k1', name: 'К1', city: 'Казань' },
      ],
      statusRows: [
        { locationId: 'm1', status: TicketStatus.NEW, count: 20 },
        { locationId: 'k1', status: TicketStatus.NEW, count: 7 },
      ],
      summaryTotal: 30,
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {})

    const citySum = result.cityGroups.reduce((sum, c) => sum + c.totalTickets, 0)
    expect(citySum).toBe(27)
    expect(result.summary.ticketsOutsideRows).toBe(3)
    expect(citySum + result.summary.ticketsOutsideRows).toBe(result.summary.totalTickets)
  })

  it('A3: SLA попадает в строку, город и организацию', async () => {
    const created = new Date('2026-10-01T10:00:00.000Z')
    const prisma = buildPrisma({
      locations: [{ id: 'm1', name: 'М1', city: 'Москва' }],
      statusRows: [{ locationId: 'm1', status: TicketStatus.DONE, count: 2 }],
      slaTickets: [
        {
          id: 't1',
          locationId: 'm1',
          createdAt: created,
          closedAt: new Date(created.getTime() + 60 * 60_000), // 60 минут
          slaDueAt: new Date(created.getTime() + 120 * 60_000), // в срок
          slaBreachedAt: null,
        },
        {
          id: 't2',
          locationId: 'm1',
          createdAt: created,
          closedAt: new Date(created.getTime() + 180 * 60_000), // 180 минут
          slaDueAt: new Date(created.getTime() + 120 * 60_000), // просрочено
          slaBreachedAt: new Date(created.getTime() + 121 * 60_000),
        },
      ],
      firstAssigned: [{ ticketId: 't1', createdAt: new Date(created.getTime() + 10 * 60_000) }],
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {})

    const row = result.items[0]
    expect(row.sla.avgResolutionMinutes).toBe(120) // (60 + 180) / 2
    expect(row.sla.avgResponseMinutes).toBe(10) // только t1 получила реакцию
    expect(row.sla.respondedCount).toBe(1)
    expect(row.sla.withinSlaCount).toBe(1)
    expect(row.sla.slaEvaluatedCount).toBe(2)
    expect(row.sla.withinSlaRatio).toBe(0.5)
    expect(row.sla.slaBreaches).toBe(1)

    expect(result.cityGroups[0].sla.avgResolutionMinutes).toBe(120)
    expect(result.summary.sla.avgResolutionMinutes).toBe(120)
    expect(result.summary.sla.slaBreaches).toBe(1)
  })

  it('A3: завершённая заявка без срока не считается выполненной в срок', async () => {
    const created = new Date('2026-10-01T10:00:00.000Z')
    const prisma = buildPrisma({
      locations: [{ id: 'm1', name: 'М1', city: 'Москва' }],
      statusRows: [{ locationId: 'm1', status: TicketStatus.DONE, count: 1 }],
      slaTickets: [
        {
          id: 't1',
          locationId: 'm1',
          createdAt: created,
          closedAt: new Date(created.getTime() + 60 * 60_000),
          slaDueAt: null,
          slaBreachedAt: null,
        },
      ],
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {})

    expect(result.items[0].sla.withoutSlaCount).toBe(1)
    expect(result.items[0].sla.slaEvaluatedCount).toBe(0)
    expect(result.items[0].sla.withinSlaRatio).toBeNull()
  })
  it('A3: реакция учитывает переход NEW → IN_PROGRESS без ASSIGNED', async () => {
    const created = new Date('2026-10-01T10:00:00.000Z')
    const prisma = buildPrisma({
      locations: [{ id: 'm1', name: 'М1', city: 'Москва' }],
      statusRows: [{ locationId: 'm1', status: TicketStatus.IN_PROGRESS, count: 1 }],
      slaTickets: [
        {
          id: 't1',
          locationId: 'm1',
          status: TicketStatus.IN_PROGRESS,
          createdAt: created,
          closedAt: null,
          slaDueAt: null,
          slaBreachedAt: null,
        },
      ],
      statusHistory: [
        { ticketId: 't1', toStatus: TicketStatus.IN_PROGRESS, createdAt: new Date(created.getTime() + 15 * 60_000) },
      ],
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {})

    expect(result.items[0].sla.respondedCount).toBe(1)
    expect(result.items[0].sla.avgResponseMinutes).toBe(15)
    expect(result.summary.sla.avgResponseMinutes).toBe(15)
  })

  it('A3: реакция — самый ранний из переходов в ASSIGNED и IN_PROGRESS', async () => {
    const created = new Date('2026-10-01T10:00:00.000Z')
    const prisma = buildPrisma({
      locations: [{ id: 'm1', name: 'М1', city: 'Москва' }],
      statusRows: [{ locationId: 'm1', status: TicketStatus.IN_PROGRESS, count: 1 }],
      slaTickets: [
        {
          id: 't1',
          locationId: 'm1',
          status: TicketStatus.IN_PROGRESS,
          createdAt: created,
          closedAt: null,
          slaDueAt: null,
          slaBreachedAt: null,
        },
      ],
      statusHistory: [
        { ticketId: 't1', toStatus: TicketStatus.IN_PROGRESS, createdAt: new Date(created.getTime() + 30 * 60_000) },
        { ticketId: 't1', toStatus: TicketStatus.ASSIGNED, createdAt: new Date(created.getTime() + 5 * 60_000) },
        // Переход в другой статус реакцией не считается.
        { ticketId: 't1', toStatus: TicketStatus.CANCELED, createdAt: new Date(created.getTime() + 1 * 60_000) },
      ],
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {})

    expect(result.items[0].sla.avgResponseMinutes).toBe(5)
  })

  it('A3: отменённая заявка с прошедшим сроком не открыта и не просрочена сейчас', async () => {
    const created = new Date('2020-01-01T10:00:00.000Z')
    const prisma = buildPrisma({
      locations: [{ id: 'm1', name: 'М1', city: 'Москва' }],
      statusRows: [
        { locationId: 'm1', status: TicketStatus.CANCELED, count: 1 },
        { locationId: 'm1', status: TicketStatus.IN_PROGRESS, count: 1 },
      ],
      overdueRows: [{ locationId: 'm1', count: 1 }],
      slaTickets: [
        {
          id: 'canceled',
          locationId: 'm1',
          status: TicketStatus.CANCELED,
          createdAt: created,
          closedAt: null, // у отменённой closedAt не ставится
          slaDueAt: new Date(created.getTime() + 60 * 60_000),
          slaBreachedAt: new Date(created.getTime() + 61 * 60_000),
        },
        {
          id: 'open',
          locationId: 'm1',
          status: TicketStatus.IN_PROGRESS,
          createdAt: created,
          closedAt: null,
          slaDueAt: new Date(created.getTime() + 60 * 60_000),
          slaBreachedAt: null,
        },
      ],
    })
    const result = await buildService(prisma).getLocationsAnalytics(CLIENT, 'admin-1', UserRole.ADMIN, {})

    for (const sla of [result.items[0].sla, result.cityGroups[0].sla, result.summary.sla]) {
      expect(sla.openCount).toBe(1)
      expect(sla.openOverdueCount).toBe(1) // только действительно открытая
      expect(sla.canceledCount).toBe(1)
      expect(sla.resolvedCount).toBe(0)
      expect(sla.slaEvaluatedCount).toBe(0)
      // Историческое нарушение остаётся и совпадает с overdueTickets остальной аналитики.
      expect(sla.slaBreaches).toBe(1)
    }
    expect(result.items[0].overdueTickets).toBe(1)
    expect(result.items[0].canceledTickets).toBe(1)
  })
})
