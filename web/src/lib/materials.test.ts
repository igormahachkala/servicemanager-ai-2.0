import { describe, expect, it } from 'vitest'

import {
  activeMaterials,
  formatMaterialQuantity,
  movementTypeLabel,
  normalizeDecimalInput,
  validateConsumptionInput,
  validateIssueInput,
  validateMaterialInput,
  validatePurchaseInput,
  type Material,
  type MaterialBalance,
} from './materials'

const material: Material = {
  id: 'material-1',
  companyId: 'company-1',
  name: 'Кабель',
  unit: 'м',
  sku: null,
  category: null,
  active: true,
  createdAt: '2026-10-04T00:00:00.000Z',
  updatedAt: '2026-10-04T00:00:00.000Z',
}
const balances: MaterialBalance[] = [{
  id: 'balance-1',
  companyId: 'company-1',
  materialId: material.id,
  holderType: 'TECHNICIAN',
  holderUserId: 'user-1',
  quantity: '13.500',
  updatedAt: '2026-10-04T00:00:00.000Z',
  material,
}]

describe('Materials V0 canonical frontend contract', () => {
  it('validates create/update fields without inventing active on create', () => {
    expect(validateMaterialInput({ name: '', unit: 'м' }).ok).toBe(false)
    expect(validateMaterialInput({ name: 'Кабель', unit: '' }).ok).toBe(false)
    expect(validateMaterialInput({ name: 'Кабель', unit: 'м' })).toEqual({ ok: true })
  })

  it('keeps decimal quantities as normalized strings', () => {
    expect(normalizeDecimalInput('2,500')).toBe('2.5')
    expect(formatMaterialQuantity('13.500', 'м')).toBe('13,5 м')
  })

  it('requires positive purchase and issue quantities', () => {
    expect(validatePurchaseInput({ materialId: 'material-1', quantity: '0' }).ok).toBe(false)
    expect(validateIssueInput({ materialId: 'material-1', quantity: '-1' }).ok).toBe(false)
    expect(validatePurchaseInput({ materialId: 'material-1', quantity: '1.25', totalAmount: '12.50' })).toEqual({ ok: true })
    expect(validateIssueInput({ materialId: 'material-1', quantity: '1.25' })).toEqual({ ok: true })
  })

  it('rejects consumption above the technician balance', () => {
    expect(validateConsumptionInput({ materialId: material.id, quantity: '13.5' }, balances)).toEqual({ ok: true })
    expect(validateConsumptionInput({ materialId: material.id, quantity: '13.501' }, balances).ok).toBe(false)
  })

  it('lists only active materials and labels canonical movement types', () => {
    expect(activeMaterials([material, { ...material, id: 'inactive', active: false }]).map((item) => item.id)).toEqual(['material-1'])
    expect(movementTypeLabel('PURCHASE')).toBe('Покупка')
    expect(movementTypeLabel('ISSUE')).toBe('Выдано')
    expect(movementTypeLabel('CONSUMPTION')).toBe('Списано в заявку')
  })
})
