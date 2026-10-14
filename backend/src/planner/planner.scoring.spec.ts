import {
  filterMaturedCandidates,
  planNext,
  score,
} from './planner.scoring'
import type { PlannerContext, PlannerPoolItem } from './planner.types'

const NOW = new Date('2026-06-15T12:00:00')

function ctx(overrides: Partial<PlannerContext> = {}): PlannerContext {
  return {
    now: NOW,
    currentLocationId: null,
    ...overrides,
  }
}

function ticket(overrides: Partial<PlannerPoolItem> & Pick<PlannerPoolItem, 'id' | 'locationId'>): PlannerPoolItem {
  return {
    kind: 'TICKET',
    dueAt: null,
    urgent: false,
    dispatcherAssigned: false,
    ...overrides,
  }
}

function inspection(
  overrides: Partial<PlannerPoolItem> & Pick<PlannerPoolItem, 'id' | 'locationId'>,
): PlannerPoolItem {
  return {
    kind: 'INSPECTION',
    dueAt: null,
    urgent: false,
    dispatcherAssigned: false,
    frequency: 'MONTHLY',
    intervalDays: 30,
    leadTimeDays: 0,
    ...overrides,
  }
}

describe('planner.scoring', () => {
  it('срочная побеждает обычную на другом объекте', () => {
    const candidates: PlannerPoolItem[] = [
      ticket({
        id: 't-normal',
        locationId: 'loc-a',
        dueAt: new Date('2026-06-16T12:00:00'),
      }),
      ticket({
        id: 't-urgent',
        locationId: 'loc-b',
        urgent: true,
        dueAt: new Date('2026-06-16T12:00:00'),
      }),
    ]

    const result = score(candidates, ctx())

    expect(result).toHaveLength(2)
    expect(result[0].locationId).toBe('loc-b')
    expect(result[0].works[0].id).toBe('t-urgent')
    expect(result[0].works[0].reasons.some((r) => r.label === 'Срочная')).toBe(true)
    expect(result[0].works[0].total).toBeGreaterThan(result[1].works[0].total)
  })

  it('просроченный обход побеждает заявку со сроком завтра', () => {
    const candidates: PlannerPoolItem[] = [
      ticket({
        id: 't-tomorrow',
        locationId: 'loc-ticket',
        dueAt: new Date('2026-06-16T15:00:00'),
      }),
      inspection({
        id: 'i-overdue',
        locationId: 'loc-insp',
        // 3 days overdue
        dueAt: new Date('2026-06-12T12:00:00'),
        frequency: 'MONTHLY',
        intervalDays: 30,
      }),
    ]

    const result = planNext(candidates, ctx())

    expect(result[0].locationId).toBe('loc-insp')
    expect(result[0].works[0].id).toBe('i-overdue')
    expect(result[0].works[0].total).toBeGreaterThan(result[1].works[0].total)
    expect(
      result[0].works[0].reasons.some((r) => r.label.startsWith('Обход просрочен на')),
    ).toBe(true)
  })

  it('две работы на одной площадке → один объект', () => {
    const candidates: PlannerPoolItem[] = [
      ticket({ id: 't1', locationId: 'loc-same', urgent: true }),
      ticket({
        id: 't2',
        locationId: 'loc-same',
        dueAt: new Date('2026-06-15T13:00:00'),
      }),
    ]

    const result = score(candidates, ctx())

    expect(result).toHaveLength(1)
    expect(result[0].locationId).toBe('loc-same')
    expect(result[0].works).toHaveLength(2)
    expect(result[0].works[0].suggestedFirst).toBe(true)
    expect(result[0].works[1].suggestedFirst).toBe(false)
    expect(result[0].works[0].id).toBe('t1')
  })

  it('обход до окна не попадает (filter)', () => {
    // MONTHLY interval 30 → window = last fifth = 6 days before due.
    // dueAt = 2026-07-01 → window opens 2026-06-25. NOW is 2026-06-15 → not matured.
    const early = inspection({
      id: 'i-early',
      locationId: 'loc-1',
      dueAt: new Date('2026-07-01T12:00:00'),
      frequency: 'MONTHLY',
      intervalDays: 30,
      leadTimeDays: 0,
    })
    const ticketOk = ticket({ id: 't-ok', locationId: 'loc-2', urgent: true })

    const filtered = filterMaturedCandidates([early, ticketOk], NOW)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('t-ok')
  })

  it('пустой вход → пустой ответ', () => {
    expect(score([], ctx())).toEqual([])
    expect(planNext([], ctx())).toEqual([])
  })

  it('две одинаковые заявки, у одной dispatcherAssigned → она впереди с причиной «Назначил диспетчер»', () => {
    const candidates: PlannerPoolItem[] = [
      ticket({
        id: 't-plain',
        locationId: 'loc-a',
        dueAt: new Date('2026-06-16T12:00:00'),
      }),
      ticket({
        id: 't-disp',
        locationId: 'loc-b',
        dueAt: new Date('2026-06-16T12:00:00'),
        dispatcherAssigned: true,
      }),
    ]

    const result = score(candidates, ctx())

    expect(result[0].works[0].id).toBe('t-disp')
    expect(result[0].works[0].reasons.some((r) => r.label === 'Назначил диспетчер')).toBe(true)
    expect(result[0].works[0].total).toBeGreaterThan(result[1].works[0].total)
  })
})
