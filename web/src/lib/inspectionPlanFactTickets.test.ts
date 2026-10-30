import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { TicketGetOne } from './api'
import {
  loadPlanFactTickets,
  planFactTicketScopeKey,
  refreshPlanFactData,
} from './inspectionPlanFactTickets'
import { run } from './inspectionPlanFact.fixtures'
const me = { id: 'manager-1', companyId: 'provider-1', role: 'ADMIN' as const }
const ticket = {
  id: 'ticket-1',
  companyId: 'client-1',
  location: { id: 'loc-1', name: 'Объект 1' },
  ticketNumber: 17,
  status: 'DONE',
  problemText: 'SECRET',
  requesterPhone: 'SECRET',
} as TicketGetOne

describe('plan/fact canonical ticket previews', () => {
  it('fetches canonical ticket under owner scope and projects only safe fields', async () => {
    const get = vi.fn().mockResolvedValue(ticket)
    const result = await loadPlanFactTickets(
      {
        run: run(),
        me,
        outboundScope: { linkedClientCompanyId: 'unrelated-client' },
      },
      get,
    )
    expect(get).toHaveBeenCalledExactlyOnceWith('ticket-1', {
      linkedClientCompanyId: 'client-1',
    })
    expect(result.tickets).toEqual([
      {
        id: 'ticket-1',
        number: 17,
        status: 'DONE',
        href: '/tickets/ticket-1?linkedClientCompanyId=client-1',
      },
    ])
    expect(JSON.stringify(result)).not.toContain('SECRET')
    expect(JSON.stringify(result)).not.toContain('problemText')
  })
  it.each([
    ['wrong id', { ...ticket, id: 'other' }],
    ['wrong owner', { ...ticket, companyId: 'other' }],
    ['wrong location', { ...ticket, location: { id: 'other', name: 'Other' } }],
    ['missing owner', { ...ticket, companyId: undefined }],
  ])('does not render %s even after a successful GET', async (_name, value) => {
    const result = await loadPlanFactTickets(
      { run: run(), me, outboundScope: {} },
      vi.fn().mockResolvedValue(value),
    )
    expect(result.tickets).toEqual([])
    expect(result.unavailable).toBe(1)
  })
  it.each([403, 404, 500])(
    'does not use source hidden metadata on HTTP %i',
    async (status) => {
      const source = run({
        findings: [
          {
            id: 'item',
            title: 'Пункт',
            status: 'ISSUE',
            ticketId: 'ticket-1',
            ticket: {
              ticketNumber: 999,
              status: 'DONE',
              problemText: 'SECRET',
            },
          } as never,
        ],
      })
      const result = await loadPlanFactTickets(
        { run: source, me, outboundScope: {} },
        vi.fn().mockRejectedValue({ status, message: 'SECRET' }),
      )
      expect(result).toEqual({ tickets: [], unavailable: 1, deferred: 0 })
    },
  )
  it('deduplicates IDs and bounds expansion to ten calls without retries', async () => {
    const findings = Array.from({ length: 12 }, (_, n) => ({
      id: `item-${n}`,
      title: 'Пункт',
      status: 'ISSUE' as const,
      ticketId: `ticket-${n}`,
    }))
    findings.push(findings[0])
    const get = vi.fn().mockRejectedValue(new Error('network'))
    const result = await loadPlanFactTickets(
      { run: run({ findings }), me, outboundScope: {} },
      get,
    )
    expect(get).toHaveBeenCalledTimes(10)
    expect(result).toEqual({ tickets: [], unavailable: 10, deferred: 2 })
  })
  it('makes no request when the source owner is unknown', async () => {
    const get = vi.fn()
    await loadPlanFactTickets(
      {
        run: run({ location: { id: 'loc-1', name: 'Unknown' } }),
        me,
        outboundScope: {},
      },
      get,
    )
    expect(get).not.toHaveBeenCalled()
  })
})

describe('explicit refresh updates active canonical ticket previews', () => {
  it('refreshes NEW to DONE with unchanged run.updatedAt, preserves data while pending and deduplicates in-flight GETs', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const source = run()
    let finish: (value: TicketGetOne) => void = () => {}
    const get = vi
      .fn()
      .mockResolvedValueOnce({ ...ticket, status: 'NEW' })
      .mockImplementationOnce(
        () =>
          new Promise<TicketGetOne>((resolve) => {
            finish = resolve
          }),
      )
    const observer = new QueryObserver(client, {
      queryKey: [
        ...planFactTicketScopeKey(me, {}),
        source.id,
        source.updatedAt,
      ],
      queryFn: () =>
        loadPlanFactTickets({ run: source, me, outboundScope: {} }, get),
    })
    const unsubscribe = observer.subscribe(() => {})
    try {
      await observer.refetch()
      expect(get).toHaveBeenCalledTimes(1)
      expect(observer.getCurrentResult().data?.tickets[0].status).toBe('NEW')
      const sources = vi.fn().mockResolvedValue({ isError: false })
      const refreshing = refreshPlanFactData(client, sources, me, {})
      await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2))
      expect(observer.getCurrentResult().data?.tickets[0].status).toBe('NEW')
      expect(observer.getCurrentResult().isFetching).toBe(true)
      const repeated = refreshPlanFactData(client, sources, me, {})
      await Promise.resolve()
      expect(get).toHaveBeenCalledTimes(2)
      finish({ ...ticket, status: 'DONE' })
      await Promise.all([refreshing, repeated])
      expect(observer.getCurrentResult().data?.tickets[0].status).toBe('DONE')
      expect(source.updatedAt).toBe(run().updatedAt)
      expect(get).toHaveBeenCalledTimes(2)
    } finally {
      unsubscribe()
      client.clear()
    }
  })
  it('does not refetch a different scope or inactive preview, or after a failed source refresh', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const otherGet = vi.fn().mockResolvedValue('other')
    const other = new QueryObserver(client, {
      queryKey: [
        ...planFactTicketScopeKey(me, { companyId: 'other' }),
        'run-other',
      ],
      queryFn: otherGet,
    })
    const unsubscribe = other.subscribe(() => {})
    try {
      await other.refetch()
      const closedGet = vi.fn().mockResolvedValue('closed')
      await client.fetchQuery({
        queryKey: [...planFactTicketScopeKey(me, {}), 'closed'],
        queryFn: closedGet,
      })
      await refreshPlanFactData(
        client,
        async () => ({ isError: false }),
        me,
        {},
      )
      await refreshPlanFactData(client, async () => ({ isError: true }), me, {
        companyId: 'other',
      })
      expect(otherGet).toHaveBeenCalledTimes(1)
      expect(closedGet).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribe()
      client.clear()
    }
  })
})
