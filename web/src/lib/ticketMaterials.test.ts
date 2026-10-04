import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from './api'
import {
  EMPTY_MATERIAL_USAGE_DRAFT,
  canConsumeMaterials,
  formatQuantity,
  formatUsageLine,
  maxQuantityFor,
  parseQuantity,
  selectableBalances,
  validateMaterialUsage,
  type TechnicianMaterialBalance,
  type TicketMaterialUsage,
} from './ticketMaterials'

/**
 * SMA-MATERIALS-V0-TICKET-USAGE.
 *
 * Правила списания материалов на заявку. Окружение тестов node, DOM нет,
 * поэтому решения проверяются исполнением чистых функций, контракт запроса —
 * подменённым fetch, а разметка — по исходнику компонента.
 */

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const panelSource = readSrc('components/tickets/TicketMaterialsPanel.tsx')
const panelCode = codeOf(panelSource)

const BALANCES: TechnicianMaterialBalance[] = [
  { materialId: 'm-cable', name: 'Кабель ВВГ 3×2.5', unit: 'м', available: '12.5' },
  { materialId: 'm-socket', name: 'Розетка Schneider', unit: 'шт', available: '4' },
  { materialId: 'm-empty', name: 'Гофра', unit: 'м', available: '0' },
]

const draft = (over: Partial<typeof EMPTY_MATERIAL_USAGE_DRAFT>) => ({
  ...EMPTY_MATERIAL_USAGE_DRAFT,
  ...over,
})

describe('V0 история материалов заявки', () => {
  it('строка истории собирается как «материал — количество единица»', () => {
    const usage: Pick<TicketMaterialUsage, 'name' | 'quantity' | 'unit'> = {
      name: 'Кабель ВВГ 3×2.5',
      quantity: '7',
      unit: 'м',
    }

    expect(formatUsageLine(usage)).toBe('Кабель ВВГ 3×2.5 — 7 м')
    expect(formatUsageLine({ name: 'Розетка Schneider', quantity: '2', unit: 'шт' })).toBe(
      'Розетка Schneider — 2 шт',
    )
  })

  it('хвостовые нули количества не показываются', () => {
    expect(formatQuantity('7.000')).toBe('7')
    expect(formatQuantity('2.50')).toBe('2.5')
    expect(formatQuantity(null)).toBe('0')
  })

  it('блок показывает все требуемые поля строки', () => {
    for (const field of ['usage.name', 'usage.unit', 'usage.quantity', 'usage.usedAt', 'usage.comment']) {
      expect(panelCode, field).toContain(field)
    }
    // Кто использовал — через существующий помощник идентичности.
    expect(panelCode).toContain('presentActorIdentity(usage.usedBy')
    // Дата — существующим форматтером «Сегодня, 14:32», своего не заводится.
    expect(panelCode).toContain('api.formatNotificationDateTime(usage.usedAt)')
  })

  it('комментарий показывается только когда он есть', () => {
    expect(panelCode).toContain('usage.comment ?')
  })

  it('пустая история не выдаётся за отказ, а отказ — за пустую историю', () => {
    expect(panelCode).toContain('usageQ.isError')
    expect(panelCode).toContain('Материалы не списывались')
    // Отсутствие данных не превращается в успешный пустой список.
    expect(panelCode).toContain('usageQ.data?.items ?? null')
  })
})

describe('V0 доступный остаток', () => {
  it('остаток выбранного материала показывается', () => {
    expect(panelCode).toContain('Доступно:')
    expect(panelCode).toContain('formatQuantity(selectedBalance.available)')
    expect(panelCode).toContain('selectedBalance.unit')
  })

  it('остаток нельзя править руками: поля ввода остатка нет', () => {
    /*
     * Остаток приходит с сервера и меняется только списанием. Поэтому
     * в разметке нет ни input, ни select, привязанного к available.
     */
    expect(panelCode).not.toMatch(/value=\{[^}]*available[^}]*\}[\s\S]{0,80}onChange/)
    expect(panelCode).not.toContain('setAvailable')
    expect(panelCode).not.toContain('setBalance')
  })

  it('материалы с нулевым остатком в выбор не попадают', () => {
    const selectable = selectableBalances(BALANCES)

    expect(selectable.map((item) => item.materialId)).toEqual(['m-cable', 'm-socket'])
  })

  it('верхняя граница поля равна остатку', () => {
    expect(maxQuantityFor('m-cable', BALANCES)).toBe('12.5')
    expect(maxQuantityFor('m-socket', BALANCES)).toBe('4')
    expect(maxQuantityFor('m-unknown', BALANCES)).toBeUndefined()
    expect(panelCode).toContain('max={maxQuantityFor(draft.materialId, balances)}')
  })
})

describe('V0 количество', () => {
  it('ноль и отрицательное отклоняются', () => {
    for (const quantity of ['0', '0.0', '-1', '-0.5']) {
      const result = validateMaterialUsage(draft({ materialId: 'm-cable', quantity }), BALANCES)
      expect(result.ok, quantity).toBe(false)
      if (!result.ok) expect(result.reason).toBe('not-positive')
    }
  })

  it('пустое и нечисловое отклоняются', () => {
    const empty = validateMaterialUsage(draft({ materialId: 'm-cable', quantity: '' }), BALANCES)
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.reason).toBe('no-quantity')

    const junk = validateMaterialUsage(draft({ materialId: 'm-cable', quantity: 'много' }), BALANCES)
    expect(junk.ok).toBe(false)
    if (!junk.ok) expect(junk.reason).toBe('not-positive')
  })

  it('больше остатка отклоняется и называет доступное', () => {
    const result = validateMaterialUsage(draft({ materialId: 'm-socket', quantity: '5' }), BALANCES)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('over-balance')
      expect(result.message).toBe('Доступно 4 шт')
    }
  })

  it('ровно остаток допускается', () => {
    const result = validateMaterialUsage(draft({ materialId: 'm-socket', quantity: '4' }), BALANCES)
    expect(result.ok).toBe(true)
  })

  it('дробное количество допускается: единицы бывают метрами и литрами', () => {
    const result = validateMaterialUsage(draft({ materialId: 'm-cable', quantity: '7.5' }), BALANCES)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload.quantity).toBe('7.5')
  })

  it('запятая принимается наравне с точкой', () => {
    expect(parseQuantity('2,5')).toBe(2.5)

    const result = validateMaterialUsage(draft({ materialId: 'm-cable', quantity: '2,5' }), BALANCES)
    expect(result.ok).toBe(true)
    // На сервер уходит нормализованная строка.
    if (result.ok) expect(result.payload.quantity).toBe('2.5')
  })
})

describe('V0 материал выбирается только из своих', () => {
  it('без выбора материала списать нельзя', () => {
    const result = validateMaterialUsage(draft({ quantity: '1' }), BALANCES)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no-material')
  })

  it('материал не с руки отклоняется, даже если id подставлен', () => {
    const result = validateMaterialUsage(
      draft({ materialId: 'm-foreign', quantity: '1' }),
      BALANCES,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unknown-material')
  })

  it('выбор строится из остатков, а не из общего каталога', () => {
    expect(panelCode).toContain('balances.map((item) =>')
    expect(panelCode).toContain('selectableBalances(balancesQ.data?.items)')
  })

  it('списывать предлагается технику', () => {
    expect(canConsumeMaterials('TECHNICIAN')).toBe(true)
    for (const role of ['ADMIN', 'MASTER', 'DISPATCHER', 'CLIENT', 'CLIENT_ADMIN', 'STAFF'] as const) {
      expect(canConsumeMaterials(role), role).toBe(false)
    }
    expect(canConsumeMaterials(undefined)).toBe(false)
  })

  it('кнопка — подсказка, а не право: решение остаётся за бэкендом', () => {
    expect(panelCode).toContain('canConsumeMaterials(role)')
    expect(panelCode).toContain('+ Добавить материал')
  })
})

describe('V0 контракт запроса', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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

  it('списание уходит с правильными ticketId, materialId и quantity', async () => {
    const calls = stubFetch({ id: 'u-1' })

    await api.consumeTicketMaterial('ticket-42', {
      materialId: 'm-cable',
      quantity: '7',
      comment: 'розетка у входа',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/tickets/ticket-42/materials')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(calls[0].init.body)).toEqual({
      materialId: 'm-cable',
      quantity: '7',
      comment: 'розетка у входа',
    })
  })

  it('комментарий необязателен и пустым не отправляется', () => {
    const result = validateMaterialUsage(
      draft({ materialId: 'm-cable', quantity: '1', comment: '   ' }),
      BALANCES,
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect('comment' in result.payload).toBe(false)
  })

  it('история и остатки читаются своими запросами', async () => {
    const usageCalls = stubFetch({ items: [] })
    await api.ticketMaterials('ticket-42')
    expect(usageCalls[0].url).toContain('/tickets/ticket-42/materials')
    vi.unstubAllGlobals()

    const balanceCalls = stubFetch({ items: [] })
    await api.technicianMaterialBalances()
    expect(balanceCalls[0].url).toContain('/materials/my-balances')
  })

  it('пути собраны в одном месте — стык с бэкендом', () => {
    expect(api.MATERIALS_API_PATHS.ticketUsage('t-1')).toBe('/tickets/t-1/materials')
    expect(api.MATERIALS_API_PATHS.technicianBalances).toBe('/materials/my-balances')
  })
})

describe('V0 после списания и при отказе', () => {
  it('успех обновляет и материалы заявки, и остатки', () => {
    expect(panelCode).toContain("queryKey: ['ticket-materials', ticketId]")
    expect(panelCode).toContain("queryKey: ['technician-material-balances']")
    expect(panelCode).toContain('invalidateQueries')
  })

  it('остаток перезапрашивается, а не правится на месте', () => {
    // Своего учёта интерфейс не ведёт: никакой локальной арифметики по остатку.
    expect(panelCode).not.toMatch(/available\s*[-+]/)
    expect(panelCode).not.toContain('setBalances')
  })

  it('отказ не превращается в успешное списание', () => {
    /*
     * Ключевое: onError не закрывает форму, не чистит черновик и не трогает
     * выборки. Закрытие и очистка живут только в onSuccess.
     */
    const onErrorStart = panelCode.indexOf('onError:')
    // Только тело обработчика: дальше идёт разметка, и в ней закрытие формы
    // живёт на кнопке «Отмена» — к обработке отказа оно не относится.
    const onError = panelCode.slice(onErrorStart, panelCode.indexOf('\n  })', onErrorStart))
    expect(onError).toContain('setSubmitError')
    expect(onError).not.toContain('invalidateQueries')
    expect(onError).not.toContain('setFormOpen(false)')
    expect(onError).not.toContain('EMPTY_MATERIAL_USAGE_DRAFT')
  })

  it('невалидный черновик до сети не доходит', () => {
    expect(panelCode).toContain('if (!validation.ok) throw new Error(validation.message)')
    expect(panelCode).toContain('disabled={!validation.ok || consumeM.isPending}')
  })
})

describe('V0 объём среза не расширен', () => {
  const forbidden: Array<[string, string[]]> = [
    ['закупки', ['purchase', 'Закупк', 'Purchase']],
    ['выдача', ['issue(', 'Выдач']],
    ['склад', ['warehouse', 'Склад']],
    ['поставщики', ['supplier', 'Поставщик']],
    ['возмещения', ['reimburse', 'Возмещен']],
    ['стоимость', ['cost', 'price', 'Стоимост', 'Цена']],
    ['offline', ['offlineQueue', 'enqueue', 'OfflineQueue']],
    ['MAX', ['maxBridge', 'readMaxInitData']],
  ]

  it.each(forbidden)('%s в блоке отсутствуют', (_label, needles) => {
    for (const needle of needles) {
      expect(panelCode, needle).not.toContain(needle)
    }
  })

  it('блок ходит только в три свои обёртки', () => {
    const calls = [...panelCode.matchAll(/api\.([A-Za-z0-9_]+)\(/g)].map((m) => m[1])
    expect([...new Set(calls)].sort()).toEqual([
      'consumeTicketMaterial',
      'formatNotificationDateTime',
      'technicianMaterialBalances',
      'ticketMaterials',
    ])
  })
})
