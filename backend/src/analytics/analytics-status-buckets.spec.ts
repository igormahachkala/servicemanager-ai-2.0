import { ServiceContractRole, ServiceContractStatus, TicketStatus, UserRole } from '@prisma/client'

import { AnalyticsService } from './analytics.service'

/**
 * SMA-ANALYTICS-AWAITING-ACCEPTANCE-GAP-081.
 *
 * Показатели в разрезе категорий и объектов считали total по всем статусам,
 * а раскладывали только в new / inProgress / done. Заявка на приёмке и
 * отменённая заявка при этом пропадали: сумма не сходилась с итогом, и тем
 * сильнее, чем дольше клиент тянул с приёмкой.
 *
 * Здесь закреплено, где оказывается каждый из шести статусов и что итог
 * сходится с суммой. Отдельно — что приёмка не спрятана внутрь done:
 * работа сделана, но клиентом не принята, и для провайдера это разные вещи.
 */

const COMPANY = 'company-1'
const ACTOR = 'actor-1'
const CATEGORY_A = 'cat-a'
const LOCATION_A = 'loc-a'

const ALL_STATUSES: TicketStatus[] = [
  TicketStatus.NEW,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_ACCEPTANCE,
  TicketStatus.DONE,
  TicketStatus.CANCELED,
]

/** По одной заявке в каждом статусе: так любая потеря сразу видна в арифметике. */
function oneOfEachByCategory() {
  return ALL_STATUSES.map((status) => ({
    problemCategoryId: CATEGORY_A,
    status,
    _count: { _all: 1 },
  }))
}

function oneOfEachByLocation() {
  return ALL_STATUSES.map((status) => ({
    locationId: LOCATION_A,
    status,
    _count: { _all: 1 },
  }))
}

function makeCategoriesService(rows: any[]) {
  const groupBy = jest.fn().mockResolvedValue(rows)
  const prisma = {
    problemCategory: {
      findMany: jest.fn().mockResolvedValue([{ id: CATEGORY_A, name: 'Электрика' }]),
    },
    ticket: { groupBy },
    company: { findUnique: jest.fn() },
  }
  const service = new AnalyticsService(prisma as any, {} as any, {} as any)
  // Область видимости проверяется отдельными тестами ниже; здесь важна арифметика.
  jest.spyOn(service as any, 'resolveScopedTicketWhere').mockResolvedValue({ companyId: COMPANY })
  return { service, groupBy }
}

function makeLocationsService(rows: any[], scope?: { scopeCompanyId: string; visibilityMode: string }) {
  const statusGroupBy = jest.fn().mockResolvedValue(rows)
  const prisma = {
    location: {
      findMany: jest.fn().mockResolvedValue([{ id: LOCATION_A, name: 'Склад', city: null, address: null }]),
    },
    problemCategory: { findMany: jest.fn().mockResolvedValue([]) },
    ticket: {
      groupBy: jest.fn().mockImplementation(async (args: any) => {
        if (Array.isArray(args.by) && args.by.includes('status')) return rows
        return []
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    company: { findUnique: jest.fn() },
  }
  const service = new AnalyticsService(prisma as any, {} as any, {} as any)
  jest
    .spyOn(service as any, 'resolveScope')
    .mockResolvedValue(scope ?? { scopeCompanyId: COMPANY, visibilityMode: 'tenant' })
  jest.spyOn(service as any, 'resolveScopedTicketWhere').mockResolvedValue({ companyId: COMPANY })
  jest.spyOn(service as any, 'applyLocationScopeToLocationWhere').mockImplementation((w: any) => w)
  jest.spyOn(service as any, 'resolveLocationScope').mockResolvedValue({ mode: 'ALL' })
  return { service, prisma, statusGroupBy }
}

describe('081 разрез по категориям: каждый статус имеет своё место', () => {
  async function categories(rows: any[]) {
    const { service } = makeCategoriesService(rows)
    const result = await service.getCategoriesAnalytics(COMPANY, ACTOR, UserRole.ADMIN)
    return result[0]
  }

  it('1. по одной заявке в каждом статусе: итог сходится с суммой', async () => {
    const item = await categories(oneOfEachByCategory())

    expect(item.total).toBe(6)
    expect(item.new + item.inProgress + item.awaitingAcceptance + item.done + item.canceled).toBe(item.total)
  })

  it.each([
    [TicketStatus.NEW, 'new'],
    [TicketStatus.ASSIGNED, 'inProgress'],
    [TicketStatus.IN_PROGRESS, 'inProgress'],
    [TicketStatus.AWAITING_ACCEPTANCE, 'awaitingAcceptance'],
    [TicketStatus.DONE, 'done'],
    [TicketStatus.CANCELED, 'canceled'],
  ])('2. %s попадает ровно в %s', async (status, bucket) => {
    const item: any = await categories([
      { problemCategoryId: CATEGORY_A, status, _count: { _all: 1 } },
    ])

    expect(item.total).toBe(1)
    expect(item[bucket]).toBe(1)
    // Ни в один другой показатель эта же заявка попасть не должна.
    const others = ['new', 'inProgress', 'awaitingAcceptance', 'done', 'canceled'].filter((k) => k !== bucket)
    for (const key of others) expect(item[key]).toBe(0)
  })

  it('3. приёмка не подмешана в done', async () => {
    const item = await categories([
      { problemCategoryId: CATEGORY_A, status: TicketStatus.AWAITING_ACCEPTANCE, _count: { _all: 3 } },
    ])

    expect(item.awaitingAcceptance).toBe(3)
    expect(item.done).toBe(0)
  })

  it('4. приёмка не подмешана в inProgress: активной работы по ней нет', async () => {
    const item = await categories([
      { problemCategoryId: CATEGORY_A, status: TicketStatus.AWAITING_ACCEPTANCE, _count: { _all: 2 } },
    ])

    expect(item.awaitingAcceptance).toBe(2)
    expect(item.inProgress).toBe(0)
  })

  it('5. ASSIGNED и IN_PROGRESS по-прежнему складываются в inProgress', async () => {
    const item = await categories([
      { problemCategoryId: CATEGORY_A, status: TicketStatus.ASSIGNED, _count: { _all: 2 } },
      { problemCategoryId: CATEGORY_A, status: TicketStatus.IN_PROGRESS, _count: { _all: 3 } },
    ])

    expect(item.inProgress).toBe(5)
  })

  it('6. категория без заявок даёт нули, а не пропуск', async () => {
    const item = await categories([])

    expect(item.total).toBe(0)
    expect([item.new, item.inProgress, item.awaitingAcceptance, item.done, item.canceled]).toEqual([0, 0, 0, 0, 0])
  })

  it('7. группировка идёт по категории и статусу', async () => {
    const { service, groupBy } = makeCategoriesService(oneOfEachByCategory())
    await service.getCategoriesAnalytics(COMPANY, ACTOR, UserRole.ADMIN)

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['problemCategoryId', 'status'] }),
    )
  })
})

describe('081 разрез по объектам: та же раскладка', () => {
  async function locations(rows: any[]) {
    const { service } = makeLocationsService(rows)
    const result: any = await service.getLocationsAnalytics(COMPANY, ACTOR, UserRole.ADMIN, {})
    return result
  }

  it('8. итог по объекту сходится с суммой показателей', async () => {
    const result = await locations(oneOfEachByLocation())
    const item = result.items[0]

    expect(item.totalTickets).toBe(6)
    expect(
      item.newTickets +
        item.inProgressTickets +
        item.awaitingAcceptanceTickets +
        item.doneTickets +
        item.canceledTickets,
    ).toBe(item.totalTickets)
  })

  it('9. приёмка по объекту считается отдельно от done', async () => {
    const result = await locations([
      { locationId: LOCATION_A, status: TicketStatus.AWAITING_ACCEPTANCE, _count: { _all: 4 } },
      { locationId: LOCATION_A, status: TicketStatus.DONE, _count: { _all: 1 } },
    ])
    const item = result.items[0]

    expect(item.awaitingAcceptanceTickets).toBe(4)
    expect(item.doneTickets).toBe(1)
  })

  it('10. сводка повторяет раскладку по объектам', async () => {
    const result = await locations(oneOfEachByLocation())

    expect(result.summary.awaitingAcceptanceTotal).toBe(1)
    expect(result.summary.doneTotal).toBe(1)
    expect(result.summary.canceledTotal).toBe(1)
    expect(result.summary.inProgressTotal).toBe(2)
  })
})

describe('081 область видимости не изменилась', () => {
  function makeScopeService(access: any) {
    const prisma = { company: { findUnique: jest.fn() } }
    const contracts = { getLinkedClientAccess: jest.fn().mockResolvedValue(access) }
    return new AnalyticsService(prisma as any, {} as any, contracts as any)
  }

  it('11. CLIENT (собственный контур) остаётся tenant', async () => {
    const service = makeScopeService(null)
    await expect(
      (service as any).resolveScope(COMPANY, UserRole.ADMIN, undefined, undefined),
    ).resolves.toEqual({ scopeCompanyId: COMPANY, visibilityMode: 'tenant' })
  })

  it('12. PRIMARY-провайдер видит контур клиента', async () => {
    const service = makeScopeService({
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.PRIMARY,
    })
    await expect(
      (service as any).resolveScope('provider-1', UserRole.ADMIN, undefined, 'client-1'),
    ).resolves.toEqual({ scopeCompanyId: 'client-1', visibilityMode: 'provider_primary' })
  })

  it('13. SECONDARY-провайдер получает собственный режим, без tenant-wide', async () => {
    const service = makeScopeService({
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.SECONDARY,
    })
    await expect(
      (service as any).resolveScope('provider-1', UserRole.MASTER, undefined, 'client-1'),
    ).resolves.toEqual({ scopeCompanyId: 'client-1', visibilityMode: 'provider_secondary' })
  })

  it('14. сужение по области доезжает до запроса, а не теряется', async () => {
    const { service, groupBy } = makeCategoriesService(oneOfEachByCategory())
    ;(service as any).resolveScopedTicketWhere.mockResolvedValue({
      companyId: COMPANY,
      locationId: { in: [LOCATION_A] },
    })

    await service.getCategoriesAnalytics(COMPANY, ACTOR, UserRole.ADMIN)

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY, locationId: { in: [LOCATION_A] } } }),
    )
  })
})
