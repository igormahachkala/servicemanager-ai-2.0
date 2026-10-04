import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  canConsumeMaterials,
  maxQuantityFor,
  selectableBalances,
  validateMaterialUsage,
} from './ticketMaterials'
import type { MaterialBalance } from './materials'

const balances: MaterialBalance[] = [{
  id: 'balance-1',
  companyId: 'company-1',
  materialId: 'material-1',
  holderType: 'TECHNICIAN',
  holderUserId: 'user-1',
  quantity: '7.500',
  updatedAt: '2026-10-04T00:00:00.000Z',
  material: {
    id: 'material-1',
    companyId: 'company-1',
    name: 'Кабель',
    unit: 'м',
    sku: null,
    category: null,
    active: true,
    createdAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z',
  },
}]

describe('Ticket materials', () => {
  it('allows add only for technician while backend remains the authority', () => {
    expect(canConsumeMaterials('TECHNICIAN')).toBe(true)
    expect(canConsumeMaterials('MASTER')).toBe(false)
  })

  it('builds a decimal-string payload and enforces the current balance', () => {
    expect(validateMaterialUsage({ materialId: 'material-1', quantity: '2,5', comment: '  работа  ' }, balances)).toEqual({
      ok: true,
      payload: { materialId: 'material-1', quantity: '2.5', comment: 'работа' },
    })
    expect(validateMaterialUsage({ materialId: 'material-1', quantity: '8', comment: '' }, balances).ok).toBe(false)
  })

  it('uses only positive balances for the selector', () => {
    expect(selectableBalances([...balances, { ...balances[0], id: 'zero', materialId: 'material-2', quantity: '0' }])).toHaveLength(1)
    expect(maxQuantityFor('material-1', balances)).toBe('7.500')
  })

  it('uses canonical endpoints and refreshes ticket usage plus balances', () => {
    const api = readFileSync(fileURLToPath(new URL('./api.ts', import.meta.url)), 'utf8')
    const panel = readFileSync(
      fileURLToPath(new URL('../components/tickets/TicketMaterialsPanel.tsx', import.meta.url)),
      'utf8',
    )
    expect(api).toContain("consumptions: '/materials/me/consumptions'")
    expect(api).toContain('/materials/tickets/')
    expect(api).toContain('/consumptions')
    expect(panel).toContain("['ticket-material-consumptions', ticketId]")
    expect(panel).toContain("['my-material-balances']")
    expect(panel).toContain("['mobile-my-material-balances']")
    expect(panel).not.toContain('/tickets/')
  })
})
