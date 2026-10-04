import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import {
  EMPTY_MATERIAL_PURCHASE_DRAFT,
  movementDirection,
  movementLabel,
  movementSignedQuantity,
  purchasableCatalog,
  validateMaterialPurchase,
  visibleBalances,
  type MaterialCatalogItem,
  type MaterialMovement,
  type TechnicianMaterialBalance,
} from '../lib/ticketMaterials'
import { materialsMobileNavLink } from './materialsMobileNav'

/**
 * SMA-MATERIALS-V0 — мобильный цикл техника.
 *
 * Получил → увидел остаток → купил сам → открыл заявку → списал → увидел
 * новый остаток и историю. Окружение тестов node, DOM нет: решения
 * проверяются исполнением, контракт запросов — подменённым fetch,
 * разметка — по исходнику.
 */

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const pageCode = codeOf(readSrc('mobile/MobileMaterialsPage.tsx'))
const ticketBlockCode = codeOf(readSrc('mobile/MobileTicketMaterials.tsx'))
const routerCode = readSrc('router.tsx')

const BALANCES: TechnicianMaterialBalance[] = [
  { materialId: 'm-cable', name: 'Кабель ВВГ 3×2.5', unit: 'м', available: '43' },
  { materialId: 'm-socket', name: 'Розетка Schneider', unit: 'шт', available: '4' },
  { materialId: 'm-zero', name: 'Гофра', unit: 'м', available: '0' },
]

const CATALOG: MaterialCatalogItem[] = [
  { id: 'm-cable', name: 'Кабель ВВГ 3×2.5', unit: 'м' },
  { id: 'm-socket', name: 'Розетка Schneider', unit: 'шт', isActive: true },
  { id: 'm-old', name: 'Снятая позиция', unit: 'шт', isActive: false },
]

const movement = (over: Partial<MaterialMovement>): MaterialMovement => ({
  id: 'mv-1',
  materialId: 'm-cable',
  name: 'Кабель ВВГ 3×2.5',
  unit: 'м',
  quantity: '20',
  kind: 'ISSUE',
  ...over,
})

function stubFetch(payload: unknown) {
  const calls: Array<{ url: string; init: any }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: any, init: any) => {
      calls.push({ url: String(url), init })
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) } as any
    }),
  )
  return calls
}

describe('V0 /m/materials — остатки', () => {
  it('экран объявлен в мобильном контуре и только в нём', () => {
    expect(routerCode).toContain('<Route path="materials"')
    expect(routerCode).toContain('component={MobileMaterialsPage}')
    // В /max материалов нет.
    const maxBlock = routerCode.slice(routerCode.indexOf('path="/max"'))
    expect(maxBlock).not.toContain('path="materials"')
  })

  it('остатки показываются названием, количеством и единицей', () => {
    expect(pageCode).toContain('item.name')
    expect(pageCode).toContain('formatQuantity(item.available)')
    expect(pageCode).toContain('item.unit')
  })

  it('нулевые остатки полезным запасом не считаются', () => {
    expect(visibleBalances(BALANCES).map((item) => item.materialId)).toEqual(['m-cable', 'm-socket'])
  })

  it('пустые остатки и отказ различимы', () => {
    expect(pageCode).toContain('balancesQ.isError')
    expect(pageCode).toContain('На руках нет материалов')
  })
})

describe('V0 /m/materials — история движений', () => {
  it('выдача, покупка и списание названы по-разному', () => {
    expect(movementLabel(movement({ kind: 'ISSUE' }))).toBe('Выдача')
    expect(movementLabel(movement({ kind: 'PURCHASE' }))).toBe('Покупка')
    expect(movementLabel(movement({ kind: 'CONSUMPTION' }))).toBe('Списание')
  })

  it('списание называет заявку, когда номер известен', () => {
    expect(
      movementLabel(movement({ kind: 'CONSUMPTION', ticketNumber: 1045, quantity: '7' })),
    ).toBe('Списание на заявку #1045')
  })

  it('знак несёт направление: приход плюс, расход минус', () => {
    expect(movementSignedQuantity(movement({ kind: 'ISSUE', quantity: '20' }))).toBe('+20 м')
    expect(movementSignedQuantity(movement({ kind: 'PURCHASE', quantity: '30' }))).toBe('+30 м')
    expect(movementSignedQuantity(movement({ kind: 'CONSUMPTION', quantity: '7' }))).toBe('−7 м')
  })

  it('знак берётся из вида, а не из знака числа', () => {
    // Ручка вправе отдать списание отрицательным — направление не удваивается.
    expect(movementSignedQuantity(movement({ kind: 'CONSUMPTION', quantity: '-7' }))).toBe('−7 м')
  })

  it('виды различимы и глазами, а не только подписью', () => {
    expect(movementDirection(movement({ kind: 'ISSUE' }))).toBe('in')
    expect(movementDirection(movement({ kind: 'PURCHASE' }))).toBe('in')
    expect(movementDirection(movement({ kind: 'CONSUMPTION' }))).toBe('out')
    expect(pageCode).toContain('mobileMaterialsOut')
    expect(pageCode).toContain('mobileMaterialsIn')
  })

  it('незнакомый вид не ломает экран', () => {
    expect(movementLabel(movement({ kind: 'ADJUSTMENT' }))).toBe('ADJUSTMENT')
    expect(movementDirection(movement({ kind: 'ADJUSTMENT' }))).toBe('in')
    // Имя поля может быть type вместо kind.
    expect(movementLabel({ ...movement({}), kind: '', type: 'PURCHASE' })).toBe('Покупка')
  })

  it('история читается своей ручкой', async () => {
    const calls = stubFetch([])
    await api.myMaterialMovements()
    expect(calls[0].url).toContain('/materials/me/movements')
    vi.unstubAllGlobals()
  })
})

describe('V0 самостоятельная покупка', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const draft = (over: Partial<typeof EMPTY_MATERIAL_PURCHASE_DRAFT>) => ({
    ...EMPTY_MATERIAL_PURCHASE_DRAFT,
    ...over,
  })

  it('материал берётся из канонического справочника', () => {
    expect(pageCode).toContain('api.materialsCatalog()')
    const invented = validateMaterialPurchase(draft({ materialId: 'm-made-up', quantity: '1' }), CATALOG)
    expect(invented.ok).toBe(false)
    if (!invented.ok) expect(invented.reason).toBe('no-material')
  })

  it('снятые позиции не предлагаются', () => {
    expect(purchasableCatalog(CATALOG).map((item) => item.id)).toEqual(['m-cable', 'm-socket'])
  })

  it('количество больше нуля обязательно', () => {
    for (const quantity of ['', '0', '-3', 'ерунда']) {
      const result = validateMaterialPurchase(draft({ materialId: 'm-cable', quantity }), CATALOG)
      expect(result.ok, quantity).toBe(false)
    }
  })

  it('дробное и запятая принимаются', () => {
    const dot = validateMaterialPurchase(draft({ materialId: 'm-cable', quantity: '30.5' }), CATALOG)
    expect(dot.ok).toBe(true)
    if (dot.ok) expect(dot.payload.quantity).toBe('30.5')

    const comma = validateMaterialPurchase(draft({ materialId: 'm-cable', quantity: '30,5' }), CATALOG)
    expect(comma.ok).toBe(true)
    if (comma.ok) expect(comma.payload.quantity).toBe('30.5')
  })

  it('покупка остатком не ограничена: это приход', () => {
    const result = validateMaterialPurchase(draft({ materialId: 'm-cable', quantity: '1000' }), CATALOG)
    expect(result.ok).toBe(true)
  })

  it('цена и сумма необязательны и пустыми не отправляются', () => {
    const bare = validateMaterialPurchase(draft({ materialId: 'm-cable', quantity: '5' }), CATALOG)
    expect(bare.ok).toBe(true)
    if (bare.ok) {
      expect('unitPrice' in bare.payload).toBe(false)
      expect('totalPrice' in bare.payload).toBe(false)
    }

    const priced = validateMaterialPurchase(
      draft({ materialId: 'm-cable', quantity: '5', unitPrice: '120,5', totalPrice: '602,5' }),
      CATALOG,
    )
    expect(priced.ok).toBe(true)
    if (priced.ok) {
      expect(priced.payload.unitPrice).toBe('120.5')
      expect(priced.payload.totalPrice).toBe('602.5')
    }
  })

  it('покупка уходит своей ручкой', async () => {
    const calls = stubFetch({ id: 'mv-9' })

    await api.recordMaterialPurchase({ materialId: 'm-cable', quantity: '30' })

    expect(calls[0].url).toContain('/materials/me/purchases')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(calls[0].init.body)).toEqual({ materialId: 'm-cable', quantity: '30' })
  })

  it('успех обновляет остатки и историю', () => {
    expect(pageCode).toContain("queryKey: ['my-material-balances']")
    expect(pageCode).toContain("queryKey: ['my-material-movements']")
  })

  it('отказ не выдаётся за успех и не добавляет остаток', () => {
    const onErrorStart = pageCode.indexOf('onError:')
    const onError = pageCode.slice(onErrorStart, pageCode.indexOf('\n  })', onErrorStart))

    expect(onError).toContain('setSubmitError')
    expect(onError).not.toContain('setPurchaseOpen(false)')
    expect(onError).not.toContain('invalidateQueries')
  })

  it('фото чека не реализуется в этом срезе', () => {
    for (const needle of ['receipt', 'Чек', 'photo', 'Фото']) {
      expect(pageCode, needle).not.toContain(needle)
    }
  })

  it('канонический остаток не считается на клиенте', () => {
    expect(pageCode).not.toMatch(/available\s*[-+]/)
    expect(pageCode).not.toContain('setBalances')
  })
})

describe('V0 списание из мобильной заявки', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ticketId, materialId и quantity уходят в тело подтверждённой ручки', async () => {
    const calls = stubFetch({ id: 'c-1' })

    await api.consumeMaterial({
      ticketId: 'ticket-1045',
      materialId: 'm-cable',
      quantity: '7',
      comment: 'ввод в щит',
      linkedClientCompanyId: 'client-7',
    })

    expect(calls[0].url).toContain('/materials/me/consumptions')
    expect(JSON.parse(calls[0].init.body)).toEqual({
      ticketId: 'ticket-1045',
      materialId: 'm-cable',
      quantity: '7',
      comment: 'ввод в щит',
      linkedClientCompanyId: 'client-7',
    })
  })

  it('угаданные пути не используются', () => {
    expect(ticketBlockCode).not.toContain('/tickets/')
    expect(JSON.stringify(api.MATERIALS_API_PATHS)).not.toContain('/tickets/${ticketId}/materials')
  })

  it('контур берётся из существующего контекста заявки, своего резолвера нет', () => {
    expect(ticketBlockCode).toContain('scope?.linkedClientCompanyId')
    expect(ticketBlockCode).not.toContain('resolveMobileTicketResourceScope')
    const page = codeOf(readSrc('mobile/MobileTicketPage.tsx'))
    expect(page).toContain('scope={ticketResourceScope}')
  })

  it('выбор строится из положительных остатков техника', () => {
    expect(ticketBlockCode).toContain('selectableBalances(balancesQ.data)')
    expect(ticketBlockCode).toContain('api.myMaterialBalances(scope)')
  })

  it('успех обновляет историю заявки, остатки и журнал', () => {
    expect(ticketBlockCode).toContain("queryKey: ['ticket-material-consumptions', ticketId]")
    expect(ticketBlockCode).toContain("queryKey: ['my-material-balances']")
    expect(ticketBlockCode).toContain("queryKey: ['my-material-movements']")
  })

  it('при отказе остаток перечитывается, а списание не появляется', () => {
    const onErrorStart = ticketBlockCode.indexOf('onError:')
    const onError = ticketBlockCode.slice(onErrorStart, ticketBlockCode.indexOf('\n  })', onErrorStart))

    // 409 означает, что остаток изменился на другом устройстве.
    expect(onError).toContain("queryKey: ['my-material-balances']")
    expect(onError).not.toContain('ticket-material-consumptions')
    expect(onError).not.toContain('setFormOpen(false)')
  })

  it('прямой массив ответа обработан: обёртки items нет', async () => {
    const calls = stubFetch([{ id: 'c-1', name: 'Кабель', unit: 'м', quantity: '7' }])

    const rows = await api.ticketMaterialConsumptions('ticket-1045')

    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toHaveLength(1)
    expect(calls[0].url).toContain('/materials/tickets/ticket-1045/consumptions')
    expect(ticketBlockCode).not.toContain('.data?.items')
  })
})

describe('V0 навигация', () => {
  it('техник доходит до экрана ссылкой, а не набором адреса', () => {
    const link = materialsMobileNavLink({ role: 'TECHNICIAN', pathname: '/m/settings' })

    expect(link).not.toBeNull()
    expect(link!.to).toBe('/m/materials')
    expect(link!.label).toBe('Мои материалы')
    expect(codeOf(readSrc('mobile/MobileSettingsPage.tsx'))).toContain('materialsMobileNavLink')
  })

  it('в MAX пункта нет', () => {
    for (const pathname of ['/max', '/max/settings']) {
      expect(materialsMobileNavLink({ role: 'TECHNICIAN', pathname }), pathname).toBeNull()
    }
  })

  it('пункт не строится через mobilePath — иначе утёк бы в /max', () => {
    const source = readSrc('mobile/materialsMobileNav.ts')
    const imports = source.slice(0, source.indexOf('/**'))
    expect(imports).not.toMatch(/\bmobilePath\b/)
    expect(imports).toMatch(/\bgetMobileRouteRoot\b/)
  })

  it('управленческих ролей этот экран не касается', () => {
    for (const role of ['ADMIN', 'MASTER', 'DISPATCHER', 'CLIENT', 'NETWORK_DIRECTOR'] as const) {
      expect(materialsMobileNavLink({ role, pathname: '/m/settings' }), role).toBeNull()
    }
    expect(materialsMobileNavLink({ role: null, pathname: '/m/settings' })).toBeNull()
  })
})

describe('V0 объём среза', () => {
  const forbidden: Array<[string, string[]]> = [
    ['склад', ['warehouse', 'Склад']],
    ['выдача другим', ['issueTo', 'Выдать']],
    ['чужие остатки', ['allTechnicians', 'Все техники']],
    ['поставщики', ['supplier', 'Поставщик']],
    ['закупки', ['procurement', 'Закупк']],
    ['возмещения', ['reimburse', 'Возмещен']],
    ['аналитика', ['analytics', 'Аналитика']],
    ['offline', ['offlineQueue', 'enqueue', 'OfflineQueue']],
    ['MAX', ['maxBridge', 'readMaxInitData']],
  ]

  it.each(forbidden)('%s отсутствуют', (_label, needles) => {
    for (const needle of needles) {
      expect(pageCode, needle).not.toContain(needle)
      expect(ticketBlockCode, needle).not.toContain(needle)
    }
  })

  it('экран ходит только в свои ручки', () => {
    const calls = [...pageCode.matchAll(/api\.([A-Za-z0-9_]+)\(/g)].map((m) => m[1])
    expect([...new Set(calls)].sort()).toEqual([
      'formatNotificationDateTime',
      'materialsCatalog',
      'myMaterialBalances',
      'myMaterialMovements',
      'recordMaterialPurchase',
    ])
  })
})
