import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import { MOBILE_HOME_BOARD_CHIP_LABELS } from './mobileHomeBoardFilters'
import { getSlaState } from './mobileHomeListUtils'

/**
 * SMA-MOBILE-URGENT-TICKETS-CARD-120.
 *
 * Карточка «Срочные заявки» на главной. Срочность — это priority=URGENT
 * и только он; счётчик приходит с сервера; список запрашивается серверным
 * фильтром, а не отбирается из уже загруженной страницы.
 *
 * Окружение тестов node, DOM нет, поэтому решения проверяются исполнением
 * там, где они вынесены в функции и в контракт API, и по исходнику там,
 * где существует только разметка.
 */

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const homeCode = codeOf(readSrc('mobile/home/MobileHome.tsx'))
const cardsCode = codeOf(readSrc('mobile/home/HomeQuickCards.tsx'))

function stubFetch(payload: unknown) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: any) => {
      calls.push(String(url))
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) } as any
    }),
  )
  return calls
}

const emptyBoard = { columns: [], meta: { totalTickets: 0, urgentTotal: 0 } }

describe('120 срочность запрашивается у сервера', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('NC2. фильтр уходит в запрос как priority=URGENT', async () => {
    const calls = stubFetch(emptyBoard)

    await api.board({ priority: 'URGENT', take: 500 })

    expect(calls[0]).toContain('priority=URGENT')
    expect(calls[0]).toContain('/tickets/board')
  })

  it('NC1. urgency в запрос доски не уходит вовсе', async () => {
    const calls = stubFetch(emptyBoard)

    await api.board({ priority: 'URGENT' })

    expect(calls[0]).not.toContain('urgency')
  })

  it('NC9. фильтр не подменяет область: она передаётся отдельно и сохраняется', async () => {
    const calls = stubFetch(emptyBoard)

    await api.board({ priority: 'URGENT', companyId: 'co-1', linkedClientCompanyId: 'client-2' })

    expect(calls[0]).toContain('companyId=co-1')
    expect(calls[0]).toContain('linkedClientCompanyId=client-2')
    expect(calls[0]).toContain('priority=URGENT')
  })

  it('без срочности параметр не появляется', async () => {
    const calls = stubFetch(emptyBoard)

    await api.board({ take: 500 })

    expect(calls[0]).not.toContain('priority=')
  })
})

describe('120 счётчик — серверный, а не длина выдачи', () => {
  it('NC4. счётчик берётся из meta.urgentTotal', () => {
    expect(homeCode).toContain('boardQ.data?.meta?.urgentTotal')
    expect(homeCode).toContain('urgentCount={urgentTotal}')
  })

  it('NC4. счётчик не считается по карточкам', () => {
    // Ни длины выдачи, ни клиентского пересчёта срочных на главной нет.
    expect(homeCode).not.toMatch(/urgentTotal\s*=\s*[^\n]*\.length/)
    expect(homeCode).not.toMatch(/filter\([^)]*priority[^)]*\)\.length/)
    expect(homeCode).not.toMatch(/urgentCards\.length/)
  })

  it('NC4. список срочных берётся отдельным серверным запросом', () => {
    expect(homeCode).toContain("priority: 'URGENT'")
    expect(homeCode).toContain('urgentCards')
    // Список не отбирается из уже загруженной страницы доски.
    expect(homeCode).not.toMatch(/list\.filter\([^)]*priority/)
  })
})

describe('120 NC8: отказ и неизвестность не равны нулю', () => {
  it('карточка рисуется только при известном положительном счётчике', () => {
    expect(cardsCode).toContain("typeof urgentCount === 'number' && urgentCount > 0")
  })

  it('счётчик объявлен допускающим «неизвестно»', () => {
    const props = readSrc('mobile/home/HomeQuickCards.tsx')
    expect(props).toContain('urgentCount: number | undefined')
  })

  it('нулевой и неизвестный счётчик не рисуют тревогу', () => {
    /*
     * Ноль — спокойное состояние: карточка отсутствует, как и у соседних
     * быстрых карт главной. Неизвестность — тоже отсутствие, но по другой
     * причине: заявить «срочных нет», не получив счётчика, нельзя.
     */
    expect(cardsCode).not.toContain('urgentCount ?? 0')
    expect(cardsCode).not.toContain('urgentCount || 0')
  })
})

describe('120 старый чип и новая карточка не спорят за одно слово', () => {
  it('чип переименован по фактическому смыслу', () => {
    expect(MOBILE_HOME_BOARD_CHIP_LABELS.urgent).toBe('Срок истекает')
  })

  it('на главной нет двух элементов с подписью «Срочные»', () => {
    expect(Object.values(MOBILE_HOME_BOARD_CHIP_LABELS)).not.toContain('Срочные')
    expect(cardsCode).toContain('Срочные заявки')
  })

  it('NC3. алгоритм чипа не тронут: это по-прежнему близость срока SLA', () => {
    const now = Date.parse('2026-09-29T12:00:00.000Z')
    const soon = { slaDueAt: '2026-09-29T12:30:00.000Z' } as any
    const later = { slaDueAt: '2026-09-29T20:00:00.000Z' } as any
    const overdue = { slaDueAt: '2026-09-29T11:00:00.000Z' } as any

    expect(getSlaState(soon, now)).toBe('warning')
    expect(getSlaState(later, now)).toBe('ok')
    expect(getSlaState(overdue, now)).toBe('breached')
  })

  it('NC3. близость срока сама по себе в новую карточку не попадает', () => {
    // Карточка считает только серверный urgentTotal, к getSlaState не обращается.
    expect(cardsCode).not.toContain('getSlaState')
    expect(homeCode).not.toMatch(/urgentTotal[\s\S]{0,80}getSlaState/)
  })
})

describe('120 объём среза', () => {
  it('новой страницы не заведено — переиспользуется список главной', () => {
    const router = readSrc('router.tsx')
    expect(router).not.toContain('urgent')
  })

  it('карточка не трогает поле urgency и семантику SLA', () => {
    expect(cardsCode).not.toContain('urgency')
    expect(homeCode).not.toMatch(/urgency\s*===\s*'URGENT'/)
  })
})

describe('129 список срочных: отказ и загрузка не выдаются за пустой результат', () => {
  it('NC14. отсутствие данных не превращается в пустой успешный список', () => {
    /*
     * Прежде urgentBoardQ.data?... || [] делал из отказа и из загрузки
     * успешно полученный пустой список, и пользователь видел «заявок нет»
     * там, где их не смогли получить.
     */
    expect(homeCode).toContain('urgentBoardQ.data')
    expect(homeCode).not.toMatch(/urgentBoardQ\.data\?\.columns[\s\S]{0,60}\|\|\s*\[\]/)
    expect(homeCode).toMatch(/urgentBoardQ\.data\s*\n?\s*\?/)
  })

  it('NC14. состояние списка берётся у того запроса, который его наполняет', () => {
    expect(homeCode).toContain('urgentListActive')
    expect(homeCode).toContain('activeBoardIsLoading = urgentListActive ? urgentBoardQ.isLoading')
    expect(homeCode).toContain('activeBoardError = urgentListActive ? urgentBoardQ.error')
    expect(homeCode).toContain('activeBoardHasData = urgentListActive ? !!urgentBoardQ.data')
  })

  it('NC14. отказ идёт по существующему пути деградации, своего не заведено', () => {
    // Ошибка срочных попадает в тот же activeBoardError, что и ошибка доски.
    expect(homeCode).toContain('boardError={activeBoardError}')
    expect(homeCode).not.toContain('urgentError')
    expect(homeCode).not.toContain('UrgentErrorBanner')
  })
})

describe('129 неизвестный счётчик в точке интеграции', () => {
  it('NC15. MobileHome не подставляет 0 вместо неизвестного счётчика', () => {
    /*
     * Мутация boardQ.data?.meta?.urgentTotal ?? 0 обязана ронять этот тест:
     * неизвестно — не ноль.
     */
    expect(homeCode).toContain('const urgentTotal = boardQ.data?.meta?.urgentTotal')
    expect(homeCode).not.toMatch(/urgentTotal\s*=\s*boardQ\.data\?\.meta\?\.urgentTotal\s*\?\?/)
    expect(homeCode).not.toMatch(/urgentTotal\s*=\s*boardQ\.data\?\.meta\?\.urgentTotal\s*\|\|/)
  })

  it('NC15. значение доходит до карточки неизменным', () => {
    expect(homeCode).toContain('urgentCount={urgentTotal}')
    expect(homeCode).not.toContain('urgentCount={urgentTotal ?? 0}')
    expect(homeCode).not.toContain('urgentCount={urgentTotal || 0}')
  })
})
