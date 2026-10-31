import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import { buildNextOccurrenceReschedule, canRescheduleNextOccurrence, nextOccurrenceDraft } from './inspectionScheduleRescheduling'

const NOW = new Date('2026-10-29T00:00:00.000Z')
function schedule(overrides: Partial<api.InspectionSchedule> = {}): api.InspectionSchedule {
  return {
    id: 'schedule-1', companyId: 'provider-1', name: 'Обход', frequency: 'WEEKLY',
    startDate: '2026-10-20T10:15:37.123Z', nextDueAt: '2026-11-03T10:15:37.123Z',
    leadTimeDays: 2, graceDays: 1, isActive: true, createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-27T09:00:00.000Z', lastGeneratedAt: '2026-10-27T09:00:00.000Z',
    lastRunId: 'run-1', lastRun: { id: 'run-1', status: 'COMPLETED', dueAt: '2026-10-27T10:15:37.123Z', completedAt: '2026-10-27T11:00:00.000Z' },
    template: { id: 'template-1', name: 'Осмотр' }, location: { id: 'location-1', name: 'Объект' },
    equipment: null, assignedTo: null, _count: { runs: 1 }, ...overrides,
  }
}

describe('next-occurrence hint and immutable draft', () => {
  it('offers only active recurring schedules with completed history', () => {
    expect(canRescheduleNextOccurrence(schedule())).toBe(true)
    expect(canRescheduleNextOccurrence(schedule({ frequency: 'CUSTOM', intervalDays: 3 }))).toBe(true)
    for (const state of [{ isActive: false }, { frequency: 'ONCE' as const }, { lastRun: null },
      { lastRun: { id: 'run-2', status: 'IN_PROGRESS' as const } }, { _count: { runs: 0 } },
      { _count: undefined }, { frequency: 'CUSTOM' as const, intervalDays: null },
      { frequency: 'CUSTOM' as const, intervalDays: 0 }, { frequency: 'CUSTOM' as const, intervalDays: 1.5 },
      { updatedAt: 'invalid' }, { nextDueAt: 'invalid' }]) expect(canRescheduleNextOccurrence(schedule(state))).toBe(false)
  })
  it('keeps exact revision/cursor and does not silently truncate unchanged seconds', () => {
    const source = schedule()
    const draft = nextOccurrenceDraft(source)
    expect(draft).toMatchObject({ expectedUpdatedAt: source.updatedAt, expectedNextDueAt: source.nextDueAt })
    expect(() => buildNextOccurrenceReschedule(draft, NOW)).toThrow('Выберите другой срок')
    expect(source.startDate).toBe('2026-10-20T10:15:37.123Z')
  })
  it('allows forward then backward to a future target without invented period limits', () => {
    const original = schedule()
    const forward = buildNextOccurrenceReschedule({ ...nextOccurrenceDraft(original), date: '2026-12-20', time: '14:35' }, NOW)
    expect(forward).toEqual({ expectedNextDueAt: original.nextDueAt, expectedUpdatedAt: original.updatedAt,
      nextDueAt: new Date(2026, 11, 20, 14, 35).toISOString() })
    const backDraft = nextOccurrenceDraft(schedule({ nextDueAt: forward.nextDueAt, updatedAt: '2026-10-29T10:01:00Z' }))
    const back = buildNextOccurrenceReschedule({ ...backDraft, date: '2026-11-02', time: '14:35' }, NOW)
    expect(new Date(back.nextDueAt).getTime()).toBeLessThan(new Date(original.nextDueAt).getTime())
    expect(back.expectedNextDueAt).toBe(forward.nextDueAt)
    expect(back.expectedUpdatedAt).toBe('2026-10-29T10:01:00Z')
    expect(Object.keys(back).sort()).toEqual(['expectedNextDueAt', 'expectedUpdatedAt', 'nextDueAt'])
  })
  it('rejects invalid dates, past targets, missing time and bad revision/cursor', () => {
    const draft = nextOccurrenceDraft(schedule())
    for (const state of [{ date: '2026-02-31' }, { date: 'invalid' }, { time: '25:00' }, { time: '' },
      { expectedUpdatedAt: 'invalid' }, { expectedNextDueAt: 'invalid' }, { date: '2026-10-20', time: '09:00' }]) {
      expect(() => buildNextOccurrenceReschedule({ ...draft, ...state }, NOW)).toThrow()
    }
  })
  it('rechecks a target that became past while confirmation was open', () => {
    const draft = { ...nextOccurrenceDraft(schedule()), date: '2026-11-04', time: '12:00' }
    const input = buildNextOccurrenceReschedule(draft, NOW)
    expect(() => buildNextOccurrenceReschedule(draft, new Date(input.nextDueAt))).toThrow('в будущем')
  })
  it('converts device-local time and rejects a nonexistent DST wall time', () => {
    const originalZone = process.env.TZ
    try {
      for (const zone of ['Europe/Moscow', 'America/New_York']) {
        process.env.TZ = zone
        const input = buildNextOccurrenceReschedule({ ...nextOccurrenceDraft(schedule()), date: '2026-12-04', time: '14:35' }, NOW)
        expect(input.nextDueAt).toBe(new Date(2026, 11, 4, 14, 35).toISOString())
        expect(input.expectedNextDueAt).toBe(schedule().nextDueAt)
      }
      expect(() => buildNextOccurrenceReschedule({ ...nextOccurrenceDraft(schedule()),
        date: '2027-03-14', time: '02:30' }, NOW)).toThrow('корректные дату и время')
    } finally {
      if (originalZone === undefined) delete process.env.TZ
      else process.env.TZ = originalZone
    }
  })
})

describe('next-occurrence API contract', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('sends only the next instant and both guards to the bounded PATCH', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(schedule()) }))
    vi.stubGlobal('fetch', fetchMock)
    const input = buildNextOccurrenceReschedule({ ...nextOccurrenceDraft(schedule()), date: '2026-11-04', time: '14:35' }, NOW)
    await api.rescheduleNextInspectionOccurrence('schedule-1', input)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/inspection/schedules/schedule-1/next-occurrence')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual(input)
  })
  it('preserves 409 without retrying legacy PATCH', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 409, text: async () => JSON.stringify({ message: 'Plan changed' }) }))
    vi.stubGlobal('fetch', fetchMock)
    const input = buildNextOccurrenceReschedule({ ...nextOccurrenceDraft(schedule()), date: '2026-11-04', time: '14:35' }, NOW)
    await expect(api.rescheduleNextInspectionOccurrence('schedule-1', input)).rejects.toMatchObject({ status: 409 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
