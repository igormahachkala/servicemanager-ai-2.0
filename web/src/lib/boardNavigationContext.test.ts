import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  appendBoardNavigationContextToPath,
  applyBoardNavigationContextToSearchParams,
  consumeBoardScrollPosition,
  normalizeBoardSourcePath,
  readBoardNavigationContextFromSearch,
  sanitizeBoardNavigationContext,
  saveBoardScrollPosition,
  type BoardNavigationContext,
} from './boardNavigationContext'
import { sanitizeInternalAppPath } from './returnToNavigation'

/**
 * SMA-TICKET-UX-V2-EXACT-BACK-CONTEXT-119J.
 *
 * Возврат из карточки заявки в тот же список. Проверяется носитель контекста —
 * адрес, — потому что именно он переживает перезагрузку, а location.state нет.
 */

const FULL: BoardNavigationContext = {
  selectedLocationId: 'loc-ufa-5',
  selectedEquipmentId: 'eq-1',
  selectedStatus: 'IN_PROGRESS',
  includeArchived: true,
  take: 60,
  tab: 'registry',
  chips: ['overdue', 'urgent'],
  search: 'холодильник',
  scopeLabel: 'Уфа 5 → Просроченные',
  sourcePath: '/tickets',
}

describe('119J контекст списка переживает адрес', () => {
  it('1. кодирование и декодирование сохраняют все поля контекста', () => {
    const params = applyBoardNavigationContextToSearchParams(new URLSearchParams(), FULL)
    const decoded = readBoardNavigationContextFromSearch(new URLSearchParams(params.toString()))

    expect(decoded).toEqual(FULL)
  })

  it('2. контекст переживает перезагрузку: адрес карточки декодируется без location.state', () => {
    // Уход в карточку: контекст кладётся в её адрес.
    const ticketHref = appendBoardNavigationContextToPath('/tickets/ticket-1', FULL)
    expect(ticketHref.startsWith('/tickets/ticket-1?')).toBe(true)

    // Перезагрузка: state потерян, остался только адрес.
    const afterReload = new URLSearchParams(ticketHref.split('?')[1])
    expect(readBoardNavigationContextFromSearch(afterReload)).toEqual(FULL)
  })

  it('3. без контекста — безопасный запасной путь, а не мусор в адресе', () => {
    expect(readBoardNavigationContextFromSearch(new URLSearchParams())).toBeUndefined()
    expect(sanitizeBoardNavigationContext(undefined)).toBeUndefined()
    expect(sanitizeBoardNavigationContext({})).toBeUndefined()
    expect(appendBoardNavigationContextToPath('/tickets/ticket-1', undefined)).toBe('/tickets/ticket-1')
  })

  it('3a. источник списка сохраняется даже когда фильтров не было', () => {
    // Нефильтрованный реестр: контекста нет, но вернуться надо в реестр.
    const params = applyBoardNavigationContextToSearchParams(new URLSearchParams(), { sourcePath: '/tickets' })
    expect(params.get('boardFrom')).toBe('/tickets')
    // Сам по себе источник контекстом не становится.
    expect(sanitizeBoardNavigationContext({ sourcePath: '/tickets' })).toBeUndefined()
  })

  it('4. подложный источник списка отбрасывается', () => {
    for (const bad of ['https://evil.example/board', '//evil.example', '/evil', 'javascript:alert(1)', '', null]) {
      expect(normalizeBoardSourcePath(bad)).toBeUndefined()
    }
    expect(normalizeBoardSourcePath('/board')).toBe('/board')
    expect(normalizeBoardSourcePath('/tickets')).toBe('/tickets')
  })

  it('5. канонический санитайзер сохраняет query и hash цели возврата', () => {
    const href = appendBoardNavigationContextToPath('/tickets?companyId=co-1', FULL)
    const safe = sanitizeInternalAppPath(href)

    expect(safe).toBe(href)
    expect(safe).toContain('companyId=co-1')
    expect(safe).toContain('boardSearch=')
    // И при этом внешние цели по-прежнему отвергаются.
    expect(sanitizeInternalAppPath('https://evil.example/board?x=1')).toBe('')
    expect(sanitizeInternalAppPath('//evil.example/board')).toBe('')
  })

  it('9. десктоп и мобильный используют одно представление контекста', () => {
    // Мобильный кладёт свой ярлык в те же ключи, что читает десктоп.
    const mobilePath = appendBoardNavigationContextToPath('/m/my', { tab: 'registry', scopeLabel: 'Мои заявки' })
    const decoded = readBoardNavigationContextFromSearch(new URLSearchParams(mobilePath.split('?')[1]))

    expect(decoded?.scopeLabel).toBe('Мои заявки')
    expect(decoded?.tab).toBe('registry')
  })
})

/**
 * Окружение тестов — node, окна нет. Подставляем минимальное хранилище тем же
 * приёмом, что и существующий browserStorage.test.ts, а не тянем jsdom.
 */
class FakeSessionStorage {
  map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value))
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  clear() {
    this.map.clear()
  }
}

function setWindow(windowValue: object | undefined) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: windowValue,
  })
}

describe('119J позиция прокрутки', () => {
  beforeEach(() => setWindow({ sessionStorage: new FakeSessionStorage(), localStorage: new FakeSessionStorage() }))
  afterEach(() => setWindow(undefined))

  const listA = '/board?boardStatus=IN_PROGRESS&boardLocationId=loc-ufa-5'
  const listB = '/board?boardStatus=NEW&boardLocationId=loc-ufa-5'

  it('6. ключ прокрутки стабилен для одного и того же состояния списка', () => {
    saveBoardScrollPosition(listA, 1234)
    expect(consumeBoardScrollPosition(listA)).toBe(1234)

    saveBoardScrollPosition(listA, 99)
    expect(consumeBoardScrollPosition(listA)).toBe(99)
  })

  it('7. разные фильтры не делят одну позицию прокрутки', () => {
    saveBoardScrollPosition(listA, 500)
    saveBoardScrollPosition(listB, 10)

    expect(consumeBoardScrollPosition(listB)).toBe(10)
    expect(consumeBoardScrollPosition(listA)).toBe(500)
  })

  it('8. позиция возвращается ровно один раз', () => {
    saveBoardScrollPosition(listA, 777)

    expect(consumeBoardScrollPosition(listA)).toBe(777)
    // Повторный заход не должен дёргать экран к старой позиции.
    expect(consumeBoardScrollPosition(listA)).toBeNull()
  })

  it('8a. отсутствие сохранённой позиции — это null, а не ноль', () => {
    // Ноль означал бы «прокрутить наверх», а это другое решение.
    expect(consumeBoardScrollPosition('/board?boardStatus=DONE')).toBeNull()
  })
})
