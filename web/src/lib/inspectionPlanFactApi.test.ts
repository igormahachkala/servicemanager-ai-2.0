import { afterEach, describe, expect, it, vi } from 'vitest'
import { getInspectionRuns } from './api'
import { planFactQueries } from './inspectionPlanFact'
import { FILTER } from './inspectionPlanFact.fixtures'

afterEach(() => vi.unstubAllGlobals())
describe('plan/fact API serialization', () => {
  it('sends completedAt boundaries with canonical Object.entries query encoding', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url))
      return { ok: true, status: 200, text: async () => '[]' } as Response
    })
    const filters = planFactQueries({
      ...FILTER,
      locationId: 'loc-1',
      employeeId: 'worker-1',
    })
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
})
