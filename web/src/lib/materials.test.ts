import { describe, expect, it } from 'vitest'

import {
  describeMovement,
  formatBalance,
  formatMovementAmount,
  formatQuantity,
  selectableMaterials,
  stockHint,
  validateIssueInput,
  validateMaterialInput,
} from './materials'

/**
 * SMA-MATERIALS-V0 — чистая логика раздела материалов.
 */

describe('материал: валидация формы', () => {
  it('требует название и единицу', () => {
    expect(validateMaterialInput({ name: '', unit: 'м' })).toEqual({ ok: false, error: 'Укажите название материала' })
    expect(validateMaterialInput({ name: '  ', unit: 'м' }).ok).toBe(false)
    expect(validateMaterialInput({ name: 'Кабель', unit: '' })).toEqual({
      ok: false,
      error: 'Укажите единицу измерения',
    })
    expect(validateMaterialInput({ name: 'Кабель', unit: 'м' })).toEqual({ ok: true })
  })
})

describe('выдача: валидация формы', () => {
  it('нельзя выдать без материала', () => {
    expect(validateIssueInput({ quantity: 5 })).toEqual({ ok: false, error: 'Выберите материал' })
  })
  it('количество строго больше нуля', () => {
    expect(validateIssueInput({ materialId: 'm1', quantity: 0 }).ok).toBe(false)
    expect(validateIssueInput({ materialId: 'm1', quantity: -3 }).ok).toBe(false)
    expect(validateIssueInput({ materialId: 'm1', quantity: NaN }).ok).toBe(false)
    expect(validateIssueInput({ materialId: 'm1', quantity: 0.5 })).toEqual({ ok: true })
  })
})

describe('остаток техника: формат', () => {
  it('«Кабель — 13 м»', () => {
    expect(formatBalance({ materialName: 'Кабель', quantity: 13, unit: 'м' })).toBe('Кабель — 13 м')
    expect(formatBalance({ materialName: 'Розетка', quantity: 3, unit: 'шт' })).toBe('Розетка — 3 шт')
  })
  it('количество без лишних нулей', () => {
    expect(formatQuantity(13)).toBe('13')
    expect(formatQuantity(13.5)).toBe('13.5')
    expect(formatQuantity(13.0)).toBe('13')
    expect(formatQuantity(Number.NaN)).toBe('0')
  })
})

describe('движение: знак и подпись', () => {
  it('приход со знаком +, расход со знаком −', () => {
    expect(formatMovementAmount({ quantity: 20, unit: 'м' })).toBe('+20 м')
    expect(formatMovementAmount({ quantity: -7, unit: 'м' })).toBe('−7 м')
  })

  it('выдача, покупка и расход различаются визуально (tone) и подписью', () => {
    const issue = describeMovement({ kind: 'ISSUE' })
    const purchase = describeMovement({ kind: 'PURCHASE' })
    const consumption = describeMovement({ kind: 'CONSUMPTION', ticketNumber: 123 })

    // приход (выдача/покупка) положителен, расход по заявке — отрицателен
    expect(issue.tone).toBe('positive')
    expect(purchase.tone).toBe('positive')
    expect(consumption.tone).toBe('negative')

    // подписи разные — различимы на глаз
    expect(new Set([issue.label, purchase.label, consumption.label]).size).toBe(3)
    expect(issue.label).toBe('выдано руководителем')
    expect(purchase.label).toBe('куплено техником')
    expect(consumption.label).toBe('заявка #123')
  })

  it('расход без номера заявки деградирует к общей подписи', () => {
    expect(describeMovement({ kind: 'CONSUMPTION', ticketNumber: null }).label).toBe('расход по заявке')
  })
})

describe('выбор материала для выдачи', () => {
  it('только активные материалы предлагаются', () => {
    const all = [
      { id: 'a', isActive: true },
      { id: 'b', isActive: false },
      { id: 'c', isActive: true },
    ]
    expect(selectableMaterials(all).map((m) => m.id)).toEqual(['a', 'c'])
  })
})

describe('подсказка по складскому остатку', () => {
  it('нет данных backend → нет подсказки, выдачу не блокируем', () => {
    expect(stockHint(null, 10)).toEqual({ available: null, insufficient: false })
    expect(stockHint(undefined, 10)).toEqual({ available: null, insufficient: false })
  })
  it('есть остаток → помечает недостаток, но решает backend', () => {
    const stock = { materialId: 'm1', unit: 'м', quantity: 5 }
    expect(stockHint(stock, 3)).toEqual({ available: 5, insufficient: false })
    expect(stockHint(stock, 8)).toEqual({ available: 5, insufficient: true })
  })
})
