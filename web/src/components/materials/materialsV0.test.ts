import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '../../lib/api'
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
  StockReceiptForm,
  TicketMaterialsPanel,
} from './MaterialsPanels'
import {
  validateManagerIssueMaterialInput,
  validateSelfPurchaseInput,
  validateStockReceiptInput,
  validateTicketMaterialUsageInput,
} from '../../lib/materials'

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', '..', relative), 'utf8')

const materials: MaterialDirectoryItem[] = [
  { id: 'mat-cable', name: 'Кабель ВВГ 3×2.5', unit: 'м', active: true, sku: 'VVG-325', category: 'Электрика' },
  { id: 'mat-socket', name: 'Розетка Schneider', unit: 'шт', active: true },
]

const balances: TechnicianMaterialBalance[] = [
  { materialId: 'mat-cable', materialName: 'Кабель ВВГ 3×2.5', unit: 'м', balance: '13.5' },
  { materialId: 'mat-socket', materialName: 'Розетка Schneider', unit: 'шт', balance: '3' },
]

const movements: MaterialMovement[] = [
  {
    id: 'move-1',
    materialId: 'mat-cable',
    materialName: 'Кабель ВВГ 3×2.5',
    unit: 'м',
    quantity: '5',
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
    quantity: '2',
    createdAt: '2026-10-04T11:00:00.000Z',
    technicianName: 'Иван Петров',
    comment: 'Заменил ввод',
  },
]

describe('Materials V0 mobile technician surfaces', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders current balances in My Materials format', () => {
    const html = renderToStaticMarkup(createElement(MaterialsBalanceList, { balances }))

    expect(html).toContain('Кабель ВВГ 3×2.5')
    expect(html).toContain('13,5 м')
    expect(html).toContain('Розетка Schneider')
    expect(html).toContain('3 шт')
  })

  it('validates self purchase form input and positive quantity', () => {
    expect(validateSelfPurchaseInput({ materialId: '', quantity: '1' })).toBe('Выберите материал')
    expect(validateSelfPurchaseInput({ materialId: 'mat-cable', quantity: '0' })).toBe('Количество должно быть больше 0')
    expect(validateSelfPurchaseInput({ materialId: 'mat-cable', quantity: '2', cost: '-1' })).toBe('Стоимость не может быть отрицательной')
    expect(validateSelfPurchaseInput({ materialId: 'mat-cable', quantity: '2.5', cost: '1200.50' })).toBeNull()

    const html = renderToStaticMarkup(createElement(SelfPurchaseForm, { materials }))
    expect(html).toContain('+ Купил материал')
    expect(html).not.toContain('Фото чека')
  })

  it('uses direct-array backend responses for my balances', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      calls.push(String(url))
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ materialId: 'mat-cable', materialName: 'Кабель', unit: 'м', quantity: '4.5' }]),
      } as any
    }))

    const rows = await api.myMaterialBalances()

    expect(calls[0]).toContain('/materials/me/balances')
    expect(rows[0].balance).toBe('4.5')
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
    expect(html).toContain('доступно 13,5 м')
  })

  it('blocks usage above available balance at UI validation level', () => {
    expect(validateTicketMaterialUsageInput({ materialId: 'mat-cable', quantity: '14' }, balances)).toBe('Доступно только 13,5 м')
    expect(validateTicketMaterialUsageInput({ materialId: 'mat-cable', quantity: '13.5' }, balances)).toBeNull()
  })

  it('renders ticket material history', () => {
    const html = renderToStaticMarkup(createElement(TicketMaterialsPanel, { usedMaterials, balances, canAdd: false }))
    expect(html).toContain('Позиций: 1')
    expect(html).toContain('2 м')
    expect(html).toContain('Иван Петров')
  })
})

describe('Materials V0 management surfaces', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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
    expect(validateManagerIssueMaterialInput({ materialId: '', quantity: '1' })).toBe('Выберите материал')
    expect(validateManagerIssueMaterialInput({ materialId: 'mat-cable', quantity: '0' })).toBe('Количество должно быть больше 0')
    expect(validateManagerIssueMaterialInput({ materialId: 'mat-cable', quantity: '1.25' })).toBeNull()
  })

  it('validates stock receipt and renders mobile stock action form', () => {
    expect(validateStockReceiptInput({ materialId: '', quantity: '1' })).toBe('Выберите материал')
    expect(validateStockReceiptInput({ materialId: 'mat-cable', quantity: '0' })).toBe('Количество должно быть больше 0')
    expect(validateStockReceiptInput({ materialId: 'mat-cable', quantity: '100.5' })).toBeNull()

    const html = renderToStaticMarkup(createElement(StockReceiptForm, { materials }))
    expect(html).toContain('Поступление на склад')
  })

  it('renders material dictionary basics', () => {
    const html = renderToStaticMarkup(createElement(MaterialDictionaryPanel, { materials }))

    expect(html).toContain('Создать материал')
    expect(html).toContain('Кабель ВВГ 3×2.5')
    expect(html).toContain('SKU VVG-325')
    expect(html).toContain('Редактировать')
    expect(html).toContain('Деактивировать')
  })

  it('uses exact backend paths for material management operations', async () => {
    const calls: Array<{ url: string; body?: string; method?: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: any, init: any = {}) => {
      calls.push({ url: String(url), body: init.body, method: init.method })
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'ok', name: 'Кабель', unit: 'м', materialId: 'mat-cable', quantity: '1' }),
      } as any
    }))

    await api.createMaterial({ name: 'Кабель', unit: 'м', active: true })
    await api.updateMaterial('mat-cable', { active: false })
    await api.recordMaterialStockReceipt({ materialId: 'mat-cable', quantity: '100.5', comment: null })
    await api.issueTechnicianMaterial('tech-1', { materialId: 'mat-cable', quantity: '2.5', comment: 'выдал' })

    expect(calls[0]).toMatchObject({ method: 'POST' })
    expect(calls[0].url).toContain('/materials')
    expect(calls[1]).toMatchObject({ method: 'PATCH' })
    expect(calls[1].url).toContain('/materials/mat-cable')
    expect(calls[1].url).not.toContain('/status')
    expect(calls[2].url).toContain('/materials/stock/receipts')
    expect(calls[2].body).toContain('"quantity":"100.5"')
    expect(calls[3].url).toContain('/materials/issues')
    expect(calls[3].body).toContain('"technicianId":"tech-1"')
    expect(calls[3].body).toContain('"quantity":"2.5"')
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

  it('keeps management actions out of technician-only visibility', () => {
    const source = readSrc('mobile/MobileMaterialsPage.tsx')
    const settingsSource = readSrc('mobile/MobileSettingsPage.tsx')

    expect(settingsSource).toContain("role === 'TECHNICIAN' ? 'Мои материалы'")
    expect(source).toContain('canUseMaterialsManagement')
    expect(source).toContain("section === 'stock' && canManage")
    expect(source).toContain("section === 'technicians' && canManage")
    expect(source).toContain("section === 'directory' && canManage")
    expect(source).toContain('stockReceiptM.isError')
    expect(source).toContain('issueM.isError')
  })

  it('uses exact ticket consumption endpoints', async () => {
    const calls: Array<{ url: string; body?: string; method?: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: any, init: any = {}) => {
      calls.push({ url: String(url), body: init.body, method: init.method })
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ id: 'use-1', materialId: 'mat-cable', materialName: 'Кабель', unit: 'м', quantity: '1', createdAt: '2026-10-04T10:00:00.000Z' }]),
      } as any
    }))

    await api.ticketMaterials('ticket-1')
    await api.useTicketMaterial('ticket-1', { materialId: 'mat-cable', quantity: '1.5', comment: null })

    expect(calls[0].url).toContain('/materials/tickets/ticket-1/consumptions')
    expect(calls[1]).toMatchObject({ method: 'POST' })
    expect(calls[1].url).toContain('/materials/me/consumptions')
    expect(calls[1].body).toContain('"ticketId":"ticket-1"')
    expect(calls[1].body).toContain('"quantity":"1.5"')
  })
})
