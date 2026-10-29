import { describe, expect, it } from 'vitest'

import type { InspectionSchedule } from '../lib/api'
import {
  groupTodaySchedules,
  plannedDateLabel,
  previousVisitsUntil,
  previousVisitStatusLabel,
  toTodayVisitCards,
  todayWindow,
} from './mobileInspectionToday'

const now = new Date(2026, 9, 29, 12)
const window = todayWindow(now)
const due = (day: number, hour = 9) => new Date(2026, 9, day, hour).toISOString()
function schedule(id: string, nextDueAt: string, overrides: Partial<InspectionSchedule> = {}): InspectionSchedule {
  return {
    id, nextDueAt, companyId: 'provider', name: id,
    frequency: 'DAILY', startDate: due(1), leadTimeDays: 0, graceDays: 0,
    isActive: true, createdAt: due(1), updatedAt: due(1),
    template: { id: 'template', name: 'Обход' },
    location: { id: 'location', name: id, address: 'Адрес объекта' },
    ...overrides,
  }
}

const ids = (rows: InspectionSchedule[]) => rows.map((row) => row.id)

describe('Today previous scheduled visits', () => {
  it('uses disjoint inclusive API windows at local midnight', () => {
    const previousUntil = previousVisitsUntil(window)
    expect(Date.parse(previousUntil) + 1).toBe(Date.parse(window.from))
    const result = groupTodaySchedules([
      schedule('midnight', window.from),
      schedule('last-today', window.to),
    ], [schedule('last-yesterday', previousUntil)], window)
    expect(ids(result.today)).toEqual(['midnight', 'last-today'])
    expect(ids(result.previous)).toEqual(['last-yesterday'])
  })

  it('retains yesterday and older unstarted or running visits separately from today', () => {
    const result = groupTodaySchedules([schedule('today', due(29))], [
      schedule('yesterday', due(28)),
      schedule('older-running', due(25), { lastRun: { id: 'run', status: 'IN_PROGRESS', dueAt: due(25) } }),
      schedule('older-new-period', due(27), { lastRun: { id: 'old', status: 'COMPLETED', dueAt: due(26) } }),
    ], window)
    expect(ids(result.today)).toEqual(['today'])
    expect(ids(result.previous)).toEqual(['yesterday', 'older-running', 'older-new-period'])
    const cards = toTodayVisitCards(result.previous, null)
    expect(cards.map((card) => card.scheduleId)).toEqual(['older-running', 'older-new-period', 'yesterday'])
    expect(cards[0]).toMatchObject({ state: 'IN_PROGRESS', runId: 'run', actionLabel: 'Продолжить' })
    expect(cards[1].state).toBe('NOT_STARTED')
  })

  it('excludes inactive, completed-current-occurrence, invalid-date and future plans', () => {
    const result = groupTodaySchedules([schedule('future', due(30))], [
      schedule('inactive', due(28), { isActive: false }),
      schedule('inactive-running', due(28), { isActive: false, lastRun: { id: 'run', status: 'IN_PROGRESS' } }),
      schedule('completed', due(28), { lastRun: { id: 'done', status: 'COMPLETED', dueAt: due(28) } }),
      schedule('invalid', 'not-a-date'),
      schedule('tomorrow-running', due(30), { lastRun: { id: 'future-run', status: 'IN_PROGRESS' } }),
    ], window)
    expect(result).toEqual({ today: [], previous: [] })
  })

  it('keeps a completed visit today visible as completed, without reopening it', () => {
    const result = groupTodaySchedules([
      schedule('done-today', due(29), { lastRun: { id: 'run', status: 'COMPLETED', dueAt: due(29) } }),
    ], [], window)
    expect(toTodayVisitCards(result.today, null)[0].actionLabel).toBe('Обход выполнен')
    expect(result.previous).toHaveLength(0)
  })

  it('deduplicates within and between responses, preferring the current-day snapshot', () => {
    const today = schedule('moved', due(29))
    const result = groupTodaySchedules([today, today], [
      schedule('moved', due(28)),
      schedule('old', due(27)), schedule('old', due(27)),
    ], window)
    expect(ids(result.today)).toEqual(['moved'])
    expect(ids(result.previous)).toEqual(['old'])
  })

  it('does not resurrect an old pending snapshot after deactivation or completion', () => {
    const result = groupTodaySchedules([
      schedule('retired', due(28), { isActive: false }),
      schedule('closed', due(28), { lastRun: { id: 'run', status: 'COMPLETED', dueAt: due(28) } }),
    ], [schedule('retired', due(28)), schedule('closed', due(28))], window)
    expect(result).toEqual({ today: [], previous: [] })
  })

  it('does not let 200 older rows displace today, and handles independent missing responses', () => {
    const previous = Array.from({ length: 200 }, (_, i) => schedule(`old-${i}`, due(1)))
    expect(groupTodaySchedules([schedule('today', due(29))], previous, window).today).toHaveLength(1)
    expect(groupTodaySchedules(undefined, previous, window).previous).toHaveLength(200)
    expect(groupTodaySchedules([schedule('today', due(29))], undefined, window).today).toHaveLength(1)
    expect(groupTodaySchedules(null, null, window)).toEqual({ today: [], previous: [] })
  })

  it('preserves server grace semantics rather than inferring overdue from a past date', () => {
    expect(previousVisitStatusLabel({ isOverdue: true })).toBe('Просрочен')
    expect(previousVisitStatusLabel({ isOverdue: false })).toBe('В пределах льготного срока')
    expect(previousVisitStatusLabel({})).toBe('Ожидает выполнения')
    const [withinGrace] = toTodayVisitCards([
      schedule('grace', due(28), { graceDays: 3, isOverdue: false }),
    ], null)
    expect(withinGrace).toMatchObject({ isOverdue: false, previousStatusLabel: 'В пределах льготного срока' })
  })

  it('shows the full local date and safely handles missing or invalid dates', () => {
    expect(plannedDateLabel(due(28))).toBe('28.10.2026')
    expect(plannedDateLabel()).toBe('')
    expect(plannedDateLabel('bad-date')).toBe('')
  })
})
