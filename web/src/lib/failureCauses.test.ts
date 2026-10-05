import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from './api'

const here = dirname(fileURLToPath(import.meta.url))
const src = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
  } as Response
}

describe('Failure Causes V1 frontend contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads ticket-scoped active causes from the canonical endpoint and supports direct arrays', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url))
      return okJson([{ id: 'cause-1', companyId: 'client-1', name: 'Естественный износ', active: true }])
    })

    const rows = await api.ticketFailureCauses('ticket-1', { linkedClientCompanyId: 'client-1' })

    expect(rows).toEqual([{ id: 'cause-1', companyId: 'client-1', name: 'Естественный износ', active: true }])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('/tickets/ticket-1/failure-causes')
    expect(calls[0]).toContain('linkedClientCompanyId=client-1')
  })

  it('submits acceptance through one canonical command with failureCauseId and idempotency key', async () => {
    const calls: Array<{ url: string; method: string; body: unknown; key: string | null }> = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      calls.push({
        url: String(url),
        method: init?.method || 'GET',
        body: init?.body,
        key: headers.get('Idempotency-Key'),
      })
      return okJson({ id: 'ticket-1', status: 'AWAITING_ACCEPTANCE' })
    })

    await api.submitTicketAcceptance(
      'ticket-1',
      { failureCauseId: 'cause-1', comment: 'Готово', attachmentIds: ['att-1'] },
      { linkedClientCompanyId: 'client-1' },
      'submit-key-1',
    )

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toContain('/tickets/ticket-1/submit-acceptance')
    expect(calls[0].url).toContain('linkedClientCompanyId=client-1')
    expect(calls[0].key).toBe('submit-key-1')
    expect(JSON.parse(String(calls[0].body))).toEqual({
      failureCauseId: 'cause-1',
      comment: 'Готово',
      attachmentIds: ['att-1'],
    })
    expect(calls[0].url).not.toContain('/status')
  })

  it('uses the canonical dictionary endpoints without physical delete', async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method || 'GET', body: init?.body })
      return okJson({ id: 'cause-1', companyId: 'client-1', name: 'Загрязнение', active: true })
    })

    await api.createFailureCause({ name: 'Загрязнение' })
    await api.updateFailureCause('cause-1', { name: 'Загрязнение фильтра' })
    await api.setFailureCauseStatus('cause-1', false)

    expect(calls.map((call) => [call.method, call.url.replace(/^.*\/api/, '')])).toEqual([
      ['POST', expect.stringContaining('/failure-causes')],
      ['PATCH', expect.stringContaining('/failure-causes/cause-1')],
      ['PATCH', expect.stringContaining('/failure-causes/cause-1/status')],
    ])
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
  })

  it('mobile and desktop submit surfaces require the submit-acceptance path instead of status bypass', () => {
    const mobile = src('mobile/MobileTicketPage.tsx')
    const mobileHome = src('mobile/home/MobileHome.tsx')
    const desktop = src('views/TicketPage.tsx')
    const actionBar = src('components/ticket-page/TicketActionBar.tsx')

    for (const source of [mobile, mobileHome, desktop]) {
      expect(source).toContain('api.submitTicketAcceptance')
      expect(source).toContain('ticketFailureCauses')
      expect(source).toContain('failureCauseId')
    }

    for (const source of [mobile, mobileHome, desktop, actionBar]) {
      expect(source).not.toMatch(/updateTicketStatus\([^)]*AWAITING_ACCEPTANCE/)
      expect(source).not.toMatch(/onSetStatus\(\{\s*status:\s*'AWAITING_ACCEPTANCE'/)
    }
  })
})
