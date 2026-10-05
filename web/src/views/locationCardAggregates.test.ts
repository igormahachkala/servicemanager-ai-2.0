import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import {
  LOCATION_AWAITING_TICKET_STATUS,
  LOCATION_IN_PROGRESS_TICKET_STATUSES,
  pickNextSchedule,
  summarizeEquipment,
  summarizeSchedules,
  summarizeTickets,
} from './locationAggregates'

/**
 * SMA-LOCATION-CARD-L2-AGGREGATES-102.
 *
 * Сводки по объекту. Главное, что здесь закрепляется, — не арифметика,
 * а границы: каждая цифра приходит из существующего авторизованного endpoint'а,
 * запрос всегда несёт locationId, и никакой выборки «по всему тенанту»
 * карточка не делает.
 */

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')

const pageSource = readSrc('views/LocationPage.tsx')

function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

const pageCode = codeOf(pageSource)

function ticketAnalyticsCallSource(): string {
  const start = pageCode.indexOf('api.analyticsLocations({')
  expect(start).toBeGreaterThanOrEqual(0)
  const end = pageCode.indexOf('}),', start)
  expect(end).toBeGreaterThan(start)
  return pageCode.slice(start, end + 3)
}

const schedule = (id: string, nextDueAt: string): api.InspectionSchedule =>
  ({ id, nextDueAt, isActive: true }) as unknown as api.InspectionSchedule

const analytics = (items: Partial<api.LocationAnalyticsItem>[]) =>
  ({ items }) as unknown as api.LocationAnalyticsResponse

describe('102/1 источники — только существующие авторизованные endpoint-ы', () => {
  it('1. карточка ходит ровно в три известных списка и в саму локацию', () => {
    const calls = [...pageCode.matchAll(/api\.([A-Za-z0-9_]+)\(/g)].map((m) => m[1])
    expect([...new Set(calls)].sort()).toEqual([
      'analyticsLocations',
      'equipmentByLocation',
      'getInspectionSchedules',
      'getLocation',
      'listEquipment',
    ])
  })

  it('1. своего агрегирующего endpoint не заведено', () => {
    expect(pageCode).not.toContain('/locations/' + '${locationId}/summary')
    // Сеть только через api.*; refetch() из состояния ошибки L1 сюда не считается.
    expect(pageCode).not.toMatch(/(^|[^A-Za-z0-9_])fetch\(/m)
  })

  it('8. каждая сводка запрашивается с locationId', () => {
    expect(pageCode).toContain('api.listEquipment({ locationId')
    expect(pageCode).toContain('api.analyticsLocations({')
    expect(ticketAnalyticsCallSource()).toContain('locationId')
    expect(pageCode).toContain('api.getInspectionSchedules({ locationId')
  })

  it('8. без locationId запрос не уходит — tenant-wide выборки не возникает', () => {
    // Все три запроса включены одним и тем же условием.
    // 2026-10: пятый запрос — оборудование объекта, включён тем же условием.
    expect(pageCode.match(/enabled: !!locationId/g)?.length).toBe(5)
  })
})

describe('102/2 оборудование', () => {
  it('2. считает всё пришедшее и отдельно то, что в работе', () => {
    expect(
      summarizeEquipment([
        { status: 'ACTIVE' },
        { status: 'ACTIVE' },
        { status: 'REPAIR' },
        { status: 'DECOMMISSIONED' },
        { status: 'INACTIVE' },
      ]),
    ).toEqual({ total: 5, active: 2 })
  })

  it('6. пустой ответ даёт нули, а не отсутствие сводки', () => {
    expect(summarizeEquipment([])).toEqual({ total: 0, active: 0 })
    expect(summarizeEquipment(undefined)).toEqual({ total: 0, active: 0 })
    expect(summarizeEquipment(null)).toEqual({ total: 0, active: 0 })
  })

  it('6. пустое состояние названо', () => {
    expect(pageCode).toContain('Нет оборудования')
  })
})

describe('102/3 заявки', () => {
  it('3. «в работе» — это NEW, ASSIGNED и IN_PROGRESS', () => {
    expect(LOCATION_IN_PROGRESS_TICKET_STATUSES).toEqual(['NEW', 'ASSIGNED', 'IN_PROGRESS'])

    const summary = summarizeTickets(
      analytics([
        {
          newTickets: 2,
          inProgressTickets: 7,
          awaitingAcceptanceTickets: 1,
          doneTickets: 100,
          canceledTickets: 50,
        },
      ]),
    )

    expect(summary.inProgress).toBe(9)
  })

  it('4. приёмка — отдельный показатель, а не часть «в работе»', () => {
    expect(LOCATION_AWAITING_TICKET_STATUS).toBe('AWAITING_ACCEPTANCE')

    const summary = summarizeTickets(analytics([{ inProgressTickets: 1, awaitingAcceptanceTickets: 7 }]))

    expect(summary).toEqual({ inProgress: 1, awaitingAcceptance: 7 })
  })

  it('3. закрытые и отменённые в счётчики не попадают', () => {
    const summary = summarizeTickets(analytics([{ doneTickets: 9, canceledTickets: 9 }]))
    expect(summary).toEqual({ inProgress: 0, awaitingAcceptance: 0 })
  })

  it('6. пустая аналитика даёт нули и названное пустое состояние', () => {
    expect(summarizeTickets(analytics([]))).toEqual({ inProgress: 0, awaitingAcceptance: 0 })
    expect(summarizeTickets(undefined)).toEqual({ inProgress: 0, awaitingAcceptance: 0 })
    expect(pageCode).toContain('Нет открытых заявок')
  })
})

describe('102/5 обходы', () => {
  const now = new Date('2026-09-29T12:00:00.000Z')

  it('5. следующим становится ближайший будущий план', () => {
    const next = pickNextSchedule(
      [
        schedule('far', '2026-12-01T10:00:00.000Z'),
        schedule('soon', '2026-09-30T10:00:00.000Z'),
        schedule('later', '2026-10-15T10:00:00.000Z'),
      ],
      now,
    )

    expect(next?.id).toBe('soon')
  })

  it('5. просроченный план следующим не становится', () => {
    const next = pickNextSchedule(
      [schedule('overdue', '2026-09-01T10:00:00.000Z'), schedule('future', '2026-10-05T10:00:00.000Z')],
      now,
    )

    expect(next?.id).toBe('future')
  })

  it('5. если будущих планов нет — следующего нет', () => {
    expect(pickNextSchedule([schedule('overdue', '2026-09-01T10:00:00.000Z')], now)).toBeNull()
  })

  it('5. порядок сервера не принимается на веру', () => {
    const next = pickNextSchedule(
      [schedule('late', '2026-11-01T10:00:00.000Z'), schedule('early', '2026-10-01T10:00:00.000Z')],
      now,
    )
    expect(next?.id).toBe('early')
  })

  it('5. непарсимая дата плана не может стать следующей', () => {
    expect(pickNextSchedule([schedule('broken', 'не дата')], now)).toBeNull()
  })

  it('6. пусто — ноль планов и названное состояние', () => {
    expect(summarizeSchedules([], now)).toEqual({ activeCount: 0, next: null })
    expect(summarizeSchedules(undefined, now)).toEqual({ activeCount: 0, next: null })
    expect(pageCode).toContain('Нет запланированных обходов')
  })

  it('5. активные планы считаются по ответу запроса active=true', () => {
    const summary = summarizeSchedules(
      [schedule('a', '2026-10-01T10:00:00.000Z'), schedule('b', '2026-10-02T10:00:00.000Z')],
      now,
    )
    expect(summary.activeCount).toBe(2)
    expect(summary.next?.id).toBe('a')
    expect(pageCode).toContain('active: true')
  })
})

describe('102/7 область не расширяется', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(payload: unknown) {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any) => {
        calls.push(String(url))
        return { ok: true, status: 200, text: async () => JSON.stringify(payload) } as any
      }),
    )
    return calls
  }

  it('7. оборудование запрашивается только для этой локации', async () => {
    const calls = stubFetch([])
    await api.listEquipment({ locationId: 'loc-1' })
    expect(calls[0]).toContain('/equipment?locationId=loc-1')
  })

  it('7. заявки запрашиваются через аналитику только для этой локации', async () => {
    const calls = stubFetch({ items: [], summary: {} })
    await api.analyticsLocations({ locationId: 'loc-1' })
    expect(calls[0]).toContain('locationId=loc-1')
    expect(calls[0]).toContain('/analytics/locations')
    expect(calls[0]).not.toContain('/tickets/board')
  })

  it('7. планы обходов запрашиваются только для этой локации', async () => {
    const calls = stubFetch([])
    await api.getInspectionSchedules({ locationId: 'loc-1', active: true })
    expect(calls[0]).toContain('/inspection/schedules?locationId=loc-1')
    expect(calls[0]).toContain('active=true')
  })

  it('7. область компании передаётся тем же параметром, что и в L1', async () => {
    const calls = stubFetch([])
    await api.listEquipment({ locationId: 'loc-1', companyId: 'client-42' })
    expect(calls[0]).toContain('companyId=client-42')
  })

  it('7. provider linked-client scope передаётся отдельным параметром аналитики', async () => {
    const calls = stubFetch({ items: [], summary: {} })
    await api.analyticsLocations({
      locationId: 'loc-1',
      companyId: 'client-42',
      linkedClientCompanyId: 'client-42',
    })

    expect(calls[0]).toContain('locationId=loc-1')
    expect(calls[0]).toContain('companyId=client-42')
    expect(calls[0]).toContain('linkedClientCompanyId=client-42')
  })

  it('7. карточка передаёт linked-client scope в ticket analytics', () => {
    expect(ticketAnalyticsCallSource()).toContain('linkedClientCompanyId: scope')
  })

  it('8. счётчики не зависят от карточек доски или take=1', () => {
    expect(pageCode).not.toContain('.cards.length')
    expect(pageCode).not.toContain('take: 1')
    expect(pageCode).not.toContain('api.board(')
  })
})

describe('102/9 наследие L1 не сломано', () => {
  it('9. состояние «не найдено» осталось единым', () => {
    expect(pageCode).toContain('Объект не найден')
    expect(pageCode).not.toContain('403')
    expect(pageCode).not.toContain('Нет доступа')
    expect(pageCode).not.toContain('Forbidden')
  })

  it('9. отказ сводки не рисует ничего и не называет причину', () => {
    // Каждый блок целиком возвращает null: даже пустой заголовок не раскрывает недоступный раздел.
    // 2026-10: четвёртый блок — оборудование, отказ так же не рисует ничего.
    expect(pageCode.match(/isError \? null/g)?.length).toBe(4)
    expect(pageCode).toMatch(/equipmentQ\.isError \? null : \(\s*<div className="panel"[\s\S]*?>Оборудование</)
    expect(pageCode).toMatch(/ticketsQ\.isError \? null : \(\s*<div className="panel"[\s\S]*?>Заявки</)
    expect(pageCode).toMatch(/schedulesQ\.isError \? null : \(\s*<div className="panel"[\s\S]*?>Обходы</)
  })
})

describe('102/10 объём среза не расширен', () => {
  const forbidden: Array<[string, string[]]> = [
    ['контакты', ['Контакт', 'contacts', 'phone', 'Телефон']],
    ['заметки', ['Заметк', 'notes', 'Notes']],
    ['вложения', ['Вложени', 'attachment', 'Attachment']],
    ['история', ['История', 'history', 'History', 'timeline']],
    ['ответственные', ['Ответственн', 'locationBindings', 'responsible']],
  ]

  it.each(forbidden)('%s в карточке отсутствуют', (_label, needles) => {
    for (const needle of needles) {
      expect(pageCode, needle).not.toContain(needle)
    }
  })

  it('10. ссылки ведут только на существующие маршруты', () => {
    expect(pageCode).toContain("to=\"/equipment\"")
    expect(pageCode).toContain("to=\"/inspection/schedules\"")
    expect(pageCode).toContain('to={ticketsTo}')
    // Ссылка на заявки строится существующим контрактом доски, а не выдуманным параметром.
    expect(pageCode).toContain('appendBoardNavigationContextToPath')
    expect(pageCode).not.toContain('?locationId=')
  })
})
