/**
 * SMA-ANALYTICS-V2-PHASE2 — проверки формул A1/A3 исполнением.
 *
 * Тесты намеренно не трогают Prisma: модуль чистый, и каждое правило здесь
 * проверяется на поведении, а не на присутствии строки в исходнике.
 */
import {
  NO_CITY_KEY,
  NO_CITY_LABEL,
  buildCityAggregates,
  cityLabel,
  computeSlaByLocation,
  computeSlaMetrics,
  emptySlaMetrics,
  normalizeCityKey,
  reconcileCityTotals,
  type AggregableLocation,
  type SlaSourceTicket,
} from './analytics-aggregates'

const MIN = 60_000

function at(minutesFromEpoch: number): Date {
  return new Date(minutesFromEpoch * MIN)
}

function ticket(overrides: Partial<SlaSourceTicket> = {}): SlaSourceTicket {
  return {
    locationId: 'loc-1',
    createdAt: at(0),
    firstAssignedAt: null,
    closedAt: null,
    slaDueAt: null,
    slaBreachedAt: null,
    ...overrides,
  }
}

function location(overrides: Partial<AggregableLocation> = {}): AggregableLocation {
  return {
    locationId: 'loc-1',
    city: 'Москва',
    totalTickets: 0,
    newTickets: 0,
    inProgressTickets: 0,
    awaitingAcceptanceTickets: 0,
    doneTickets: 0,
    canceledTickets: 0,
    overdueTickets: 0,
    ...overrides,
  }
}

describe('normalizeCityKey / cityLabel', () => {
  it('сворачивает регистр и пробелы только в ключе', () => {
    expect(normalizeCityKey('Москва')).toBe(normalizeCityKey('  москва  '))
    expect(normalizeCityKey('Нижний  Новгород')).toBe(normalizeCityKey('нижний новгород'))
  })

  it('пустой город даёт отдельную группу, а не пустую строку', () => {
    expect(normalizeCityKey(null)).toBe(NO_CITY_KEY)
    expect(normalizeCityKey('   ')).toBe(NO_CITY_KEY)
    expect(cityLabel(null)).toBe(NO_CITY_LABEL)
  })

  it('подпись сохраняет написание из данных', () => {
    expect(cityLabel('  Казань ')).toBe('Казань')
  })
})

describe('computeSlaMetrics — реакция', () => {
  it('считает среднее только по заявкам, которые взяли в работу', () => {
    const m = computeSlaMetrics([
      ticket({ firstAssignedAt: at(10) }), // 10 минут
      ticket({ firstAssignedAt: at(20) }), // 20 минут
      ticket(), // не назначена — не участвует
    ])
    expect(m.respondedCount).toBe(2)
    expect(m.avgResponseMinutes).toBe(15)
  })

  it('неназначенная заявка не даёт нулевой реакции', () => {
    const m = computeSlaMetrics([ticket(), ticket()])
    expect(m.respondedCount).toBe(0)
    expect(m.avgResponseMinutes).toBeNull()
  })

  it('берёт первый перевод в работу, а не последний', () => {
    // В модуль приходит уже минимум из истории; проверяем, что он и используется.
    const m = computeSlaMetrics([ticket({ createdAt: at(0), firstAssignedAt: at(5) })])
    expect(m.avgResponseMinutes).toBe(5)
  })
})

describe('computeSlaMetrics — решение', () => {
  it('считает среднее только по завершённым', () => {
    const m = computeSlaMetrics([
      ticket({ closedAt: at(100) }), // 100
      ticket({ closedAt: at(200) }), // 200
      ticket(), // открыта — не участвует
    ])
    expect(m.resolvedCount).toBe(2)
    expect(m.avgResolutionMinutes).toBe(150)
  })

  it('не смешивает открытые и завершённые: открытая не удлиняет среднее', () => {
    const closedOnly = computeSlaMetrics([ticket({ closedAt: at(60) })])
    const withOpen = computeSlaMetrics([ticket({ closedAt: at(60) }), ticket()])
    expect(withOpen.avgResolutionMinutes).toBe(closedOnly.avgResolutionMinutes)
    expect(withOpen.resolvedCount).toBe(1)
  })

  it('битые данные (закрыто раньше создания) не уводят среднее в минус', () => {
    const m = computeSlaMetrics([ticket({ createdAt: at(100), closedAt: at(10) })])
    expect(m.avgResolutionMinutes).toBe(0)
  })
})

describe('computeSlaMetrics — доля в SLA', () => {
  it('считает долю по завершённым заявкам со заданным сроком', () => {
    const m = computeSlaMetrics([
      ticket({ closedAt: at(50), slaDueAt: at(60) }), // в срок
      ticket({ closedAt: at(70), slaDueAt: at(60) }), // просрочено
    ])
    expect(m.slaEvaluatedCount).toBe(2)
    expect(m.withinSlaCount).toBe(1)
    expect(m.withinSlaRatio).toBe(0.5)
  })

  it('закрытие точно в срок считается соблюдением', () => {
    const m = computeSlaMetrics([ticket({ closedAt: at(60), slaDueAt: at(60) })])
    expect(m.withinSlaCount).toBe(1)
    expect(m.withinSlaRatio).toBe(1)
  })

  it('ОТСУТСТВИЕ срока НЕ считается выполнением SLA', () => {
    const m = computeSlaMetrics([
      ticket({ closedAt: at(50) }), // срок не задан
      ticket({ closedAt: at(50) }),
    ])
    expect(m.withoutSlaCount).toBe(2)
    expect(m.slaEvaluatedCount).toBe(0)
    expect(m.withinSlaCount).toBe(0)
    // null, а не 1 и не 0: оценивать нечего, и выдавать 100% нельзя.
    expect(m.withinSlaRatio).toBeNull()
  })

  it('заявка без срока не попадает ни в числитель, ни в знаменатель', () => {
    const withSlaOnly = computeSlaMetrics([ticket({ closedAt: at(50), slaDueAt: at(60) })])
    const mixed = computeSlaMetrics([
      ticket({ closedAt: at(50), slaDueAt: at(60) }),
      ticket({ closedAt: at(50) }),
    ])
    expect(mixed.withinSlaRatio).toBe(withSlaOnly.withinSlaRatio)
    expect(mixed.slaEvaluatedCount).toBe(1)
  })

  it('открытая заявка со сроком не оценивается до завершения', () => {
    const m = computeSlaMetrics([ticket({ slaDueAt: at(60) })])
    expect(m.slaEvaluatedCount).toBe(0)
    expect(m.withinSlaRatio).toBeNull()
  })
})

describe('computeSlaMetrics — нарушения', () => {
  it('берёт нарушения из slaBreachedAt', () => {
    const m = computeSlaMetrics([
      ticket({ slaBreachedAt: at(99) }),
      ticket({ slaBreachedAt: at(99) }),
      ticket(),
    ])
    expect(m.slaBreaches).toBe(2)
  })

  it('нарушение учитывается и у незавершённой заявки', () => {
    const m = computeSlaMetrics([ticket({ slaBreachedAt: at(99) })])
    expect(m.slaBreaches).toBe(1)
    expect(m.resolvedCount).toBe(0)
  })
})

describe('пустые наборы', () => {
  it('пустой список даёт нули и null, а не ошибку', () => {
    expect(computeSlaMetrics([])).toEqual(emptySlaMetrics())
  })

  it('точка без заявок получает нулевые показатели', () => {
    const empty = emptySlaMetrics()
    expect(empty.avgResponseMinutes).toBeNull()
    expect(empty.avgResolutionMinutes).toBeNull()
    expect(empty.withinSlaRatio).toBeNull()
    expect(empty.slaBreaches).toBe(0)
  })
})

describe('computeSlaByLocation', () => {
  it('разводит заявки по точкам', () => {
    const byLoc = computeSlaByLocation([
      ticket({ locationId: 'a', closedAt: at(10) }),
      ticket({ locationId: 'b', closedAt: at(30) }),
      ticket({ locationId: 'b', closedAt: at(50) }),
    ])
    expect(byLoc.get('a')?.avgResolutionMinutes).toBe(10)
    expect(byLoc.get('b')?.avgResolutionMinutes).toBe(40)
    expect(byLoc.has('c')).toBe(false)
  })
})

describe('buildCityAggregates', () => {
  it('складывает канонические счётчики точек по городу', () => {
    const cities = buildCityAggregates([
      location({ locationId: 'a', city: 'Москва', totalTickets: 20, overdueTickets: 2, newTickets: 5 }),
      location({ locationId: 'b', city: 'москва', totalTickets: 14, overdueTickets: 1, newTickets: 3 }),
      location({ locationId: 'c', city: 'Казань', totalTickets: 7 }),
    ])
    const moscow = cities.find((c) => c.cityKey === normalizeCityKey('Москва'))
    expect(moscow?.locationsCount).toBe(2)
    expect(moscow?.totalTickets).toBe(34)
    expect(moscow?.overdueTickets).toBe(3)
    expect(moscow?.newTickets).toBe(8)
    expect(cities.find((c) => c.cityLabel === 'Казань')?.totalTickets).toBe(7)
  })

  it('«Город не указан» всегда последним, остальные по убыванию заявок', () => {
    const cities = buildCityAggregates([
      location({ locationId: 'a', city: null, totalTickets: 999 }),
      location({ locationId: 'b', city: 'Казань', totalTickets: 7 }),
      location({ locationId: 'c', city: 'Москва', totalTickets: 34 }),
    ])
    expect(cities.map((c) => c.cityLabel)).toEqual(['Москва', 'Казань', NO_CITY_LABEL])
  })

  it('точки без заявок дают город с нулями, а не исчезают', () => {
    const cities = buildCityAggregates([location({ locationId: 'a', city: 'Казань', totalTickets: 0 })])
    expect(cities).toHaveLength(1)
    expect(cities[0].locationsCount).toBe(1)
    expect(cities[0].totalTickets).toBe(0)
    expect(cities[0].sla).toEqual(emptySlaMetrics())
  })

  it('SLA города считается по заявкам, а не усреднением средних по точкам', () => {
    const cities = buildCityAggregates(
      [
        location({ locationId: 'big', city: 'Москва', totalTickets: 3 }),
        location({ locationId: 'small', city: 'Москва', totalTickets: 1 }),
      ],
      [
        ticket({ locationId: 'big', closedAt: at(10) }),
        ticket({ locationId: 'big', closedAt: at(10) }),
        ticket({ locationId: 'big', closedAt: at(10) }),
        ticket({ locationId: 'small', closedAt: at(410) }),
      ],
    )
    // По заявкам: (10+10+10+410)/4 = 110.
    // Усреднение средних дало бы (10+410)/2 = 210 — так считать нельзя.
    expect(cities[0].sla.avgResolutionMinutes).toBe(110)
  })

  it('заявки точек вне выборки в город не попадают', () => {
    const cities = buildCityAggregates(
      [location({ locationId: 'known', city: 'Москва', totalTickets: 1 })],
      [
        ticket({ locationId: 'known', closedAt: at(10) }),
        ticket({ locationId: 'hidden-inactive', closedAt: at(1000) }),
      ],
    )
    expect(cities).toHaveLength(1)
    expect(cities[0].sla.resolvedCount).toBe(1)
    expect(cities[0].sla.avgResolutionMinutes).toBe(10)
  })
})

describe('reconcileCityTotals — тождество с summary', () => {
  it('сумма по городам плюс заявки вне строк равна итогу области', () => {
    const rows = [
      location({ locationId: 'a', city: 'Москва', totalTickets: 20 }),
      location({ locationId: 'b', city: 'Казань', totalTickets: 7 }),
    ]
    const cities = buildCityAggregates(rows)
    const summaryTotalTickets = 30 // 27 в строках + 3 у деактивированной точки
    const ticketsOutsideRows = summaryTotalTickets - 27
    expect(reconcileCityTotals(cities, ticketsOutsideRows)).toBe(summaryTotalTickets)
  })

  it('без расхождения тождество тоже держится', () => {
    const cities = buildCityAggregates([location({ locationId: 'a', totalTickets: 5 })])
    expect(reconcileCityTotals(cities, 0)).toBe(5)
  })
})
