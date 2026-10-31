import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getServiceHistory, getServiceHistoryLinks, serviceHistoryFilter, serviceHistoryPath,
  serviceHistoryRows, SERVICE_HISTORY_LIMIT, SERVICE_HISTORY_TICKET_LIMIT,
  type ServiceHistoryRun,
} from './serviceHistory'
const row = {
  id: 'run-1', scheduleId: 'plan-1', title: 'Historical title',
  location: { id: 'location-1', name: 'Object' }, equipment: { id: 'equipment-1', name: 'Unit' },
} as ServiceHistoryRun
const target = { equipmentId: 'equipment-1' }
const scope = { linkedClientCompanyId: 'client-1' }
function mockFetch(routes: Record<string, { body: unknown; status?: number }>) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input))
    const response = routes[url.pathname + url.search] ?? { body: {}, status: 404 }
    return new Response(JSON.stringify(response.body), { status: response.status ?? 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
function runWithTickets(ids: string[]) {
  return {
    id: row.id, locationId: row.location.id, equipmentId: row.equipment?.id,
    items: ids.map((ticketId) => ({ ticketId, ticket: { id: ticketId, ticketNumber: 9999, status: 'SECRET' } })),
  }
}
afterEach(() => vi.unstubAllGlobals())

describe('service history bounds, filters and navigation', () => {
  it('never makes an unscoped history query', () => {
    expect(() => serviceHistoryFilter({})).toThrow()
    expect(() => serviceHistoryFilter({ equipmentId: '  ' })).toThrow()
    expect(serviceHistoryFilter({ locationId: ' site ' })).toEqual({ locationId: 'site', equipmentId: undefined, limit: 20 })
  })
  it('serializes equipmentId using the real canonical API client without tenant override', async () => {
    const fetchMock = mockFetch({ '/inspection/runs?equipmentId=equipment-1&limit=20': { body: [] } })
    expect(await getServiceHistory(target)).toEqual([])
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('equipmentId')).toBe('equipment-1')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.has('companyId')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('retains exact filters, removes duplicate runs and bounds the list', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...row, id: `run-${i}` }))
    expect(serviceHistoryRows([row, row, ...many], target)).toHaveLength(SERVICE_HISTORY_LIMIT)
    expect(serviceHistoryRows([{ ...row, equipment: null }], target)).toEqual([])
    expect(serviceHistoryRows([row], { locationId: 'different' })).toEqual([])
    expect(serviceHistoryRows([row, row], { locationId: 'location-1' })).toEqual([row])
  })
  it('preserves linked-client and observer scope without conversion', () => {
    expect(serviceHistoryPath('/inspection/runs/run-1/report', scope)).toBe('/inspection/runs/run-1/report?linkedClientCompanyId=client-1')
    expect(serviceHistoryPath('/tickets/ticket-1', { companyId: 'observer' })).toBe('/tickets/ticket-1?companyId=observer')
    expect(serviceHistoryPath('/tickets/ticket-1', {})).toBe('/tickets/ticket-1')
  })
})
describe('source reads fail closed', () => {
  it('uses direct ticket status only, deduplicates refs and authorizes plan separately', async () => {
    const fetchMock = mockFetch({
      '/inspection/runs/run-1': { body: runWithTickets(['ticket-1', 'ticket-1', 'denied']) },
      '/inspection/schedules/plan-1': { body: { id: 'plan-1', name: 'Authorized plan', location: { id: 'location-1' } } },
      '/tickets/ticket-1?linkedClientCompanyId=client-1': { body: { id: 'ticket-1', ticketNumber: 12, status: 'DONE' } },
      '/tickets/denied?linkedClientCompanyId=client-1': { body: { message: 'Secret details' }, status: 403 },
    })
    const links = await getServiceHistoryLinks(row, target, scope)
    expect(links).toEqual({
      plan: { name: 'Authorized plan', path: '/inspection/schedules?locationId=location-1&linkedClientCompanyId=client-1' },
      tickets: [{ id: 'ticket-1', number: 12, status: 'DONE', path: '/tickets/ticket-1?linkedClientCompanyId=client-1' }], incomplete: false,
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(JSON.stringify(links)).not.toMatch(/denied|SECRET|9999|Secret details/)
  })
  it.each([403, 404])('suppresses plan and ticket %i without leaking ids or counts', async (status) => {
    mockFetch({
      '/inspection/runs/run-1': { body: runWithTickets(['secret-id']) },
      '/inspection/schedules/plan-1': { body: { name: 'Hidden plan' }, status },
      '/tickets/secret-id?linkedClientCompanyId=client-1': { body: { ticketNumber: 345 }, status },
    })
    expect(await getServiceHistoryLinks(row, target, scope)).toEqual({ plan: null, tickets: [], incomplete: false })
  })
  it('distinguishes transient failures from absence without returning error payload', async () => {
    mockFetch({
      '/inspection/runs/run-1': { body: runWithTickets(['ticket-1']) },
      '/inspection/schedules/plan-1': { body: { message: 'Sensitive server data' }, status: 503 },
      '/tickets/ticket-1?linkedClientCompanyId=client-1': { body: {}, status: 500 },
    })
    expect(await getServiceHistoryLinks(row, target, scope)).toEqual({ plan: null, tickets: [], incomplete: true })
  })
  it('does not fall back to stale data when run is outside the requested target', async () => {
    const fetchMock = mockFetch({ '/inspection/runs/run-1': { body: { ...runWithTickets(['ticket-1']), equipmentId: 'other' } } })
    await expect(getServiceHistoryLinks(row, target, scope)).rejects.toThrow('История изменилась')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('bounds ticket fanout and skips absent plan references', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `ticket-${i}`)
    const fetchMock = mockFetch({ '/inspection/runs/run-1': { body: runWithTickets(ids) } })
    await getServiceHistoryLinks({ ...row, scheduleId: null }, target, scope)
    expect(fetchMock).toHaveBeenCalledTimes(1 + SERVICE_HISTORY_TICKET_LIMIT)
  })
  it('checks direct-ticket denial again after a previous success', async () => {
    const routes = {
      '/inspection/runs/run-1': { body: runWithTickets(['ticket-1']) },
      '/tickets/ticket-1?linkedClientCompanyId=client-1': { body: { id: 'ticket-1', status: 'DONE' }, status: 200 },
    }
    mockFetch(routes)
    expect((await getServiceHistoryLinks({ ...row, scheduleId: null }, target, scope)).tickets).toHaveLength(1)
    routes['/tickets/ticket-1?linkedClientCompanyId=client-1'].status = 404
    expect((await getServiceHistoryLinks({ ...row, scheduleId: null }, target, scope)).tickets).toEqual([])
  })
})


describe('history interrupted reads', () => {
  it('does not request sources when already collapsed or replaced', async () => {
    const fetchMock = mockFetch({})
    const abort = new AbortController()
    abort.abort()
    await expect(getServiceHistoryLinks(row, target, scope, abort.signal)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('stops fanout after the in-flight run read when the row closes', async () => {
    const abort = new AbortController()
    const fetchMock = vi.fn(async () => {
      abort.abort()
      return new Response(JSON.stringify(runWithTickets(['ticket-1'])))
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(getServiceHistoryLinks(row, target, scope, abort.signal)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('does not reveal links if the source run itself is unavailable', async () => {
    const fetchMock = mockFetch({ '/inspection/runs/run-1': { body: {}, status: 404 } })
    await expect(getServiceHistoryLinks(row, target, scope)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
