import { afterEach, describe, expect, it, vi } from 'vitest'
import { getInspectionRuns, getInspectionSchedules } from './api'
import { loadPlanFact, planFactQueries } from './inspectionPlanFact'
import { FILTER, NOW } from './inspectionPlanFact.fixtures'

afterEach(() => vi.unstubAllGlobals())
describe('plan/fact API serialization', () => {
  it('sends completedAt boundaries with canonical Object.entries query encoding', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url))
      return { ok: true, status: 200, text: async () => '[]' } as Response
    })
    const filters = planFactQueries(
      { ...FILTER, locationId: 'loc-1', employeeId: 'worker-1' },
      NOW,
    )
    await getInspectionRuns(filters.completed)
    const query = new URL(calls[0], 'https://fixture.test').searchParams
    expect(query.get('completedFrom')).toBe(filters.completed.completedFrom)
    expect(query.get('completedTo')).toBe(filters.completed.completedTo)
    expect(query.get('performedByUserId')).toBe('worker-1')
    expect(query.get('locationId')).toBe('loc-1')
    expect(query.get('limit')).toBe('200')
    expect(query.has('from')).toBe(false)
    expect(calls).toHaveLength(1)
  })
  it('asks for overdue plans up to now, without a lower period bound', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url))
      return { ok: true, status: 200, text: async () => '[]' } as Response
    })
    const filters = planFactQueries(
      { ...FILTER, locationId: 'loc-1', employeeId: 'worker-1' },
      NOW,
    )
    await getInspectionSchedules(filters.overdueSchedules)
    const query = new URL(calls[0], 'https://fixture.test').searchParams
    expect(query.get('to')).toBe(new Date(NOW).toISOString())
    expect(query.has('from')).toBe(false)
    expect(query.get('active')).toBe('true')
    expect(query.get('locationId')).toBe('loc-1')
    expect(query.get('assignedToUserId')).toBe('worker-1')
  })

  it('loads overdue plans as a separate request without the period window', async () => {
    const calls: URL[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(new URL(String(url), 'https://fixture.test'))
      return { ok: true, status: 200, text: async () => '[]' } as Response
    })
    try {
      const loaded = await loadPlanFact({ ...FILTER, locationId: 'loc-1' })
      expect(loaded).toEqual({
        schedules: [],
        overdueSchedules: [],
        completed: [],
        active: [],
      })
      const schedules = calls.filter((url) =>
        url.pathname.endsWith('/inspection/schedules'),
      )
      expect(schedules).toHaveLength(2)
      const overdue = schedules.find((url) => !url.searchParams.has('from'))
      expect(overdue?.searchParams.get('to')).toBeTruthy()
      expect(overdue?.searchParams.get('active')).toBe('true')
      expect(overdue?.searchParams.get('locationId')).toBe('loc-1')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
