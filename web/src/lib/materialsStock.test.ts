import { afterEach, describe, expect, it, vi } from 'vitest'

import { MATERIALS_API, companyStockBalances } from './api'

/**
 * P2 WAREHOUSE STOCK — раздел «Склад» должен читать остатки компании.
 *
 * Дефект: страница склада остатки не запрашивала и не показывала. Здесь
 * закреплён контракт чтения — GET /materials/stock/balances — и разбор ответа.
 */
describe('companyStockBalances', () => {
  afterEach(() => vi.restoreAllMocks())

  it('endpoint указывает на складской остаток компании', () => {
    expect(MATERIALS_API.stockBalances).toBe('/materials/stock/balances')
  })

  it('делает GET на /materials/stock/balances и возвращает остатки', async () => {
    const rows = [
      { id: 'b1', companyId: 'co', materialId: 'm1', holderType: 'COMPANY_STOCK', holderUserId: null, quantity: '7', updatedAt: '2026-10-20T00:00:00.000Z' },
    ]
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(rows),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)

    const result = await companyStockBalances()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url).endsWith('/materials/stock/balances')).toBe(true)
    expect((init?.method || 'GET')).toBe('GET')
    expect(init?.body).toBeUndefined()
    expect(result).toEqual(rows)
  })
})
