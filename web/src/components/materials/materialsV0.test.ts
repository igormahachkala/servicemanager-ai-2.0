import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type {
  MaterialDirectoryItem,
  MaterialMovement,
  TechnicianMaterialBalance,
  TicketMaterialUsage,
} from '../../lib/materials'
import {
  EmployeeTechnicianMaterialsSection,
  MaterialDictionaryPanel,
  MaterialsBalanceList,
  SelfPurchaseForm,
  TicketMaterialsPanel,
} from './MaterialsPanels'
import {
  validateManagerIssueMaterialInput,
  validateSelfPurchaseInput,
  validateTicketMaterialUsageInput,
} from '../../lib/materials'

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', '..', relative), 'utf8')

const materials: MaterialDirectoryItem[] = [
  { id: 'mat-cable', name: 'Кабель ВВГ 3×2.5', unit: 'м', active: true, sku: 'VVG-325', category: 'Электрика' },
  { id: 'mat-socket', name: 'Розетка Schneider', unit: 'шт', active: true },
]

const balances: TechnicianMaterialBalance[] = [
  { materialId: 'mat-cable', materialName: 'Кабель ВВГ 3×2.5', unit: 'м', balance: 13 },
  { materialId: 'mat-socket', materialName: 'Розетка Schneider', unit: 'шт', balance: 3 },
]

const movements: MaterialMovement[] = [
  {
    id: 'move-1',
    materialId: 'mat-cable',
    materialName: 'Кабель ВВГ 3×2.5',
    unit: 'м',
    quantity: 5,
    type: 'PURCHASE',
    createdAt: '2026-10-04T10:00:00.000Z',
    actorName: 'Иван Петров',
    comment: 'Купил на объекте',
  },
]

const usedMaterials: TicketMaterialUsage[] = [
  {
    id: 'usage-1',
    materialId: 'mat-cable',
    materialName: 'Кабель ВВГ 3×2.5',
    unit: 'м',
    quantity: 2,
    createdAt: '2026-10-04T11:00:00.000Z',
    technicianName: 'Иван Петров',
    comment: 'Заменил ввод',
  },
]

describe('Materials V0 mobile technician surfaces', () => {
  it('renders current balances in My Materials format', () => {
    const html = renderToStaticMarkup(createElement(MaterialsBalanceList, { balances }))

    expect(html).toContain('Кабель ВВГ 3×2.5')
    expect(html).toContain('13 м')
    expect(html).toContain('Розетка Schneider')
    expect(html).toContain('3 шт')
  })

  it('validates self purchase form input and positive quantity', () => {
    expect(validateSelfPurchaseInput({ materialId: '', quantity: 1 })).toBe('Выберите материал')
    expect(validateSelfPurchaseInput({ materialId: 'mat-cable', quantity: 0 })).toBe('Количество должно быть больше 0')
    expect(validateSelfPurchaseInput({ materialId: 'mat-cable', quantity: 2, cost: -1 })).toBe('Стоимость не может быть отрицательной')
    expect(validateSelfPurchaseInput({ materialId: 'mat-cable', quantity: 2, cost: 1200 })).toBeNull()

    const html = renderToStaticMarkup(createElement(SelfPurchaseForm, { materials }))
    expect(html).toContain('+ Купил материал')
    expect(html).toContain('Фото чека')
    expect(html).toContain('attachment-архитектуру')
  })
})

describe('Materials V0 ticket usage', () => {
  it('shows available balance in the ticket material form', () => {
    const html = renderToStaticMarkup(
      createElement(TicketMaterialsPanel, {
        usedMaterials,
        balances,
      }),
    )

    expect(html).toContain('Материалы')
    expect(html).toContain('Заменил ввод')
    expect(html).toContain('Кабель ВВГ 3×2.5')
    expect(html).toContain('доступно 13 м')
  })

  it('blocks usage above available balance at UI validation level', () => {
    expect(validateTicketMaterialUsageInput({ materialId: 'mat-cable', quantity: 14 }, balances)).toBe('Доступно только 13 м')
    expect(validateTicketMaterialUsageInput({ materialId: 'mat-cable', quantity: 13 }, balances)).toBeNull()
  })

  it('renders ticket material history', () => {
    const html = renderToStaticMarkup(createElement(TicketMaterialsPanel, { usedMaterials, balances, canAdd: false }))
    expect(html).toContain('Позиций: 1')
    expect(html).toContain('2 м')
    expect(html).toContain('Иван Петров')
  })
})

describe('Materials V0 management surfaces', () => {
  it('renders technician employee card materials section', () => {
    const html = renderToStaticMarkup(
      createElement(EmployeeTechnicianMaterialsSection, {
        balances,
        movements,
        materials,
      }),
    )

    expect(html).toContain('Текущие остатки')
    expect(html).toContain('История движений')
    expect(html).toContain('+ Выдать материал')
  })

  it('validates manager issue form input', () => {
    expect(validateManagerIssueMaterialInput({ materialId: '', quantity: 1 })).toBe('Выберите материал')
    expect(validateManagerIssueMaterialInput({ materialId: 'mat-cable', quantity: 0 })).toBe('Количество должно быть больше 0')
    expect(validateManagerIssueMaterialInput({ materialId: 'mat-cable', quantity: 1 })).toBeNull()
  })

  it('renders material dictionary basics', () => {
    const html = renderToStaticMarkup(createElement(MaterialDictionaryPanel, { materials }))

    expect(html).toContain('Создать материал')
    expect(html).toContain('Кабель ВВГ 3×2.5')
    expect(html).toContain('SKU VVG-325')
    expect(html).toContain('Деактивировать')
  })
})

describe('Materials V0 route/source contract', () => {
  it('adds mobile route only under /m, not /max', () => {
    const router = readSrc('router.tsx')
    const mobileBlock = router.slice(router.indexOf('path="/m"'), router.indexOf('path="/"', router.indexOf('path="/m"')))
    const maxBlock = router.slice(router.indexOf('path="/max"'))

    expect(mobileBlock).toContain('path="materials"')
    expect(mobileBlock).toContain('MobileMaterialsPage')
    expect(maxBlock).not.toContain('path="materials"')
  })

  it('keeps ticket materials out of the offline queue path', () => {
    const source = readSrc('mobile/MobileTicketPage.tsx')
    expect(source).toContain('api.useTicketMaterial')
    expect(source).not.toContain('queueOfflineMaterial')
    expect(source).not.toContain('offline/material')
  })
})
