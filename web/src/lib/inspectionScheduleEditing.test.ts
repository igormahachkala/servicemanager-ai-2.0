import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import { buildNotStartedScheduleEdit, canEditNotStartedSchedule, changeScheduleEditClient,
  changeScheduleEditLocation, scheduleEditDraft, scheduleEditSelectionIssue } from './inspectionScheduleEditing'

function schedule(overrides: Partial<api.InspectionSchedule> = {}): api.InspectionSchedule {
  return {
    id: 'schedule-1', companyId: 'provider-1', name: 'Плановый обход', frequency: 'ONCE',
    startDate: '2026-11-03T10:15:37.123Z', nextDueAt: '2026-11-03T10:15:37.123Z',
    leadTimeDays: 2, graceDays: 1, isActive: true, createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-29T09:00:00.000Z', lastGeneratedAt: null, lastRunId: null, lastRun: null,
    template: { id: 'template-1', name: 'Осмотр' },
    location: { id: 'location-1', clientCompanyId: 'client-1', name: 'Объект' },
    equipment: { id: 'equipment-1', name: 'Насос' }, assignedTo: { id: 'technician-1', email: 'tech@example.test' },
    _count: { runs: 0 }, ...overrides,
  }
}
const options = { templates: [{ id: 'template-1' }], locations: [{ id: 'location-1' }],
  equipment: [{ id: 'equipment-1' }], assignees: [{ id: 'technician-1' }] }

describe('never-started schedule eligibility', () => {
  it('allows only active zero-run schedules with a usable revision', () => {
    expect(canEditNotStartedSchedule(schedule())).toBe(true)
    for (const overrides of [{ isActive: false }, { _count: undefined }, { _count: { runs: 1 } },
      { lastGeneratedAt: '2026-10-29T09:01:00Z' }, { lastRunId: 'run-1' },
      { lastRun: { id: 'run-1', status: 'IN_PROGRESS' as const } },
      { lastRun: { id: 'run-1', status: 'COMPLETED' as const } }, { updatedAt: 'invalid' }]) {
      expect(canEditNotStartedSchedule(schedule(overrides))).toBe(false)
    }
  })
})

describe('schedule editor draft and payload', () => {
  it('preloads client scope, optional links and the exact revision', () => {
    const original = schedule()
    const draft = scheduleEditDraft(original)
    expect(draft).toMatchObject({ clientCompanyId: 'client-1', equipmentId: 'equipment-1',
      assignedToUserId: 'technician-1', templateId: 'template-1', locationId: 'location-1', expectedUpdatedAt: original.updatedAt })
    expect(buildNotStartedScheduleEdit(draft)).toMatchObject({ startDate: original.startDate, intervalDays: null })
  })
  it('does not truncate seconds or move an unchanged start date while editing the name', () => {
    const original = schedule()
    expect(buildNotStartedScheduleEdit({ ...scheduleEditDraft(original), name: ' Новое название ' })).toEqual({
      expectedUpdatedAt: original.updatedAt, templateId: 'template-1', locationId: 'location-1',
      equipmentId: 'equipment-1', assignedToUserId: 'technician-1', name: 'Новое название',
      frequency: 'ONCE', intervalDays: null, startDate: original.startDate })
  })
  it('clears dependent fields only for an explicit different location/client without altering the revision', () => {
    const draft = scheduleEditDraft(schedule())
    expect(changeScheduleEditLocation(draft, draft.locationId)).toBe(draft)
    expect(changeScheduleEditClient(draft, draft.clientCompanyId)).toBe(draft)
    expect(changeScheduleEditLocation(draft, 'location-2')).toMatchObject({ locationId: 'location-2',
      equipmentId: '', assignedToUserId: '', expectedUpdatedAt: draft.expectedUpdatedAt })
    expect(changeScheduleEditClient(draft, 'client-2')).toMatchObject({ clientCompanyId: 'client-2',
      locationId: '', equipmentId: '', assignedToUserId: '', expectedUpdatedAt: draft.expectedUpdatedAt })
    expect(draft.equipmentId).toBe('equipment-1')
  })
  it('keeps empty optional links legal and explicitly clears them', () => {
    const draft = scheduleEditDraft(schedule({ companyId: 'client-1', equipment: null, assignedTo: null }))
    expect(draft.clientCompanyId).toBe('')
    expect(buildNotStartedScheduleEdit(draft)).toMatchObject({ equipmentId: null, assignedToUserId: null })
    expect(scheduleEditSelectionIssue(draft, { ...options, equipment: [], assignees: [] })).toBeNull()
  })
  it('preserves stale values for explicit correction rather than silently clearing them', () => {
    const draft = scheduleEditDraft(schedule())
    expect(scheduleEditSelectionIssue(draft, { ...options, equipment: [] })).toContain('оборудование недоступно')
    expect(scheduleEditSelectionIssue(draft, { ...options, assignees: [] })).toContain('техник недоступен')
    expect(scheduleEditSelectionIssue(draft, { ...options, locations: [] })).toContain('доступную точку')
    expect(scheduleEditSelectionIssue(draft, { ...options, templates: [] })).toContain('доступный шаблон')
    expect(draft.equipmentId).toBe('equipment-1')
    expect(draft.assignedToUserId).toBe('technician-1')
  })
  it('rejects missing fields and impossible dates instead of normalizing them', () => {
    const draft = scheduleEditDraft(schedule())
    for (const patch of [{ name: '  ' }, { name: 'a'.repeat(161) }, { templateId: '' }, { locationId: '' },
      { date: '2026-02-31' }, { date: 'invalid' }, { time: '25:00' }, { time: '' }, { expectedUpdatedAt: 'invalid' }]) {
      expect(() => buildNotStartedScheduleEdit({ ...draft, ...patch })).toThrow()
    }
  })
  it('converts a changed wall-clock time into ISO in the device timezone', () => {
    const draft = scheduleEditDraft(schedule())
    const input = buildNotStartedScheduleEdit({ ...draft, date: '2026-12-04', time: '14:35' })
    expect(input.startDate).toBe(new Date(2026, 11, 4, 14, 35).toISOString())
    expect(input.expectedUpdatedAt).toBe(draft.expectedUpdatedAt)
  })
  it('accepts bounded integer custom intervals and clears the old interval on a fixed frequency', () => {
    const draft = scheduleEditDraft(schedule({ frequency: 'CUSTOM', intervalDays: 14 }))
    expect(buildNotStartedScheduleEdit(draft).intervalDays).toBe(14)
    expect(buildNotStartedScheduleEdit({ ...draft, frequency: 'WEEKLY' }).intervalDays).toBeNull()
    for (const intervalDays of ['', '0', '-1', '1.5', '3651', 'bad']) {
      expect(() => buildNotStartedScheduleEdit({ ...draft, intervalDays })).toThrow(/целое число/)
    }
    for (const intervalDays of ['1', '3650']) {
      expect(buildNotStartedScheduleEdit({ ...draft, intervalDays }).intervalDays).toBe(Number(intervalDays))
    }
  })
})

describe('safe edit API contract', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('uses only the bounded endpoint with the immutable revision and editable fields', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(schedule()) }))
    vi.stubGlobal('fetch', fetchMock)
    const input = buildNotStartedScheduleEdit(scheduleEditDraft(schedule()))
    await api.editNotStartedInspectionSchedule('schedule-1', input)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/inspection/schedules/schedule-1/not-started')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual(input)
    for (const field of ['isActive', 'graceDays', 'leadTimeDays']) expect(input).not.toHaveProperty(field)
  })
  it('preserves a typed 409 and does not fall back to legacy PATCH', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 409, text: async () => JSON.stringify({ message: 'Plan changed' }) }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.editNotStartedInspectionSchedule('schedule-1', buildNotStartedScheduleEdit(scheduleEditDraft(schedule()))))
      .rejects.toMatchObject({ status: 409 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('uses canonical equipment-by-location with client scope', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '[]' }))
    vi.stubGlobal('fetch', fetchMock)
    await api.equipmentByLocation('location-1', 'client-1')
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('/equipment/location/location-1?companyId=client-1')
  })
})
