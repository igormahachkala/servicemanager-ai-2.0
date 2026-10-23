import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  TICKET_NAV_SOURCES,
  buildTicketNavContext,
  readTicketNavContext,
  readTicketNavRestoreKey,
  readTicketNavSnapshot,
  resolveTicketBack,
  sanitizeTicketNavReturnTo,
  saveTicketNavSnapshot,
  stripTicketNav,
  ticketNavOriginCaption,
  ticketNavSourceLabel,
  withTicketNav,
  type TicketNavContext,
  type TicketNavSource,
} from './ticketNavContext'

class MemoryStorage {
  map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null
  }
  getItem(k: string) {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v))
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
  clear() {
    this.map.clear()
  }
}

const DESKTOP_TICKET = '/tickets/t-1'
const MOBILE_TICKET = '/m/tickets/t-1'
const MAX_TICKET = '/max/tickets/t-1'

function ctx(source: TicketNavSource, returnTo: string, originIdx: number | null = 3): TicketNavContext {
  return { v: 1, source, returnTo, originKey: 'k-src', originIdx }
}

describe('sanitizeTicketNavReturnTo — какие адреса списка принимаются', () => {
  const accepted: Array<[TicketNavSource, string, string]> = [
    ['board', '/board?boardStatus=NEW&linkedClientCompanyId=c-1', DESKTOP_TICKET],
    ['board', '/tickets?boardTab=registry', DESKTOP_TICKET],
    ['rounds', '/inspection/runs/r-1', DESKTOP_TICKET],
    ['rounds', '/inspection/runs/r-1/report', DESKTOP_TICKET],
    ['rounds', '/inspection/quick/r-1', DESKTOP_TICKET],
    ['home', '/m', MOBILE_TICKET],
    ['home', '/m/', MOBILE_TICKET],
    ['acceptance', '/m?linkedClientCompanyId=c-1', MOBILE_TICKET],
    ['my', '/m/my?boardTab=done&boardSearch=%D0%BA%D1%80%D0%B0%D0%BD', MOBILE_TICKET],
    ['chats', '/m/chats', MOBILE_TICKET],
    ['chats', '/m/chats/t-9', MOBILE_TICKET],
    ['notifications', '/m/notifications', MOBILE_TICKET],
    ['rounds', '/m/inspection/r-1', MOBILE_TICKET],
    ['rounds', '/m/inspection/today', MOBILE_TICKET],
    ['home', '/max', MAX_TICKET],
    ['chats', '/max/chats/t-9', MAX_TICKET],
  ]
  it.each(accepted)('%s ← %s', (source, returnTo, ticket) => {
    expect(sanitizeTicketNavReturnTo(source, returnTo, ticket)).toBe(returnTo)
  })

  const rejected: Array<[string, TicketNavSource, unknown, string]> = [
    ['внешний адрес', 'board', 'https://evil.example/board', DESKTOP_TICKET],
    ['protocol-relative', 'board', '//evil.example/board', DESKTOP_TICKET],
    ['обратный слэш', 'board', '/\\evil.example/board', DESKTOP_TICKET],
    ['javascript:', 'board', 'javascript:alert(1)', DESKTOP_TICKET],
    ['не строка', 'board', { pathname: '/board' }, DESKTOP_TICKET],
    ['пустая строка', 'board', '', DESKTOP_TICKET],
    ['путь вне allowlist', 'board', '/work-calendar', DESKTOP_TICKET],
    ['страница входа', 'home', '/login?returnTo=/m', MOBILE_TICKET],
    ['чужой раздел: мобильный список для desktop-карточки', 'home', '/m', DESKTOP_TICKET],
    ['чужой раздел: desktop-доска для мобильной карточки', 'board', '/board', MOBILE_TICKET],
    ['чужой раздел: /m для карточки /max', 'home', '/m', MAX_TICKET],
    ['адрес не своего источника', 'chats', '/m/notifications', MOBILE_TICKET],
    ['карточка заявки вместо списка', 'board', '/tickets/t-2', DESKTOP_TICKET],
    ['мобильная карточка вместо списка', 'my', '/m/tickets/t-2', MOBILE_TICKET],
    ['подпуть доски', 'board', '/board/extra', DESKTOP_TICKET],
    ['обход без идентификатора', 'rounds', '/inspection/runs', DESKTOP_TICKET],
  ]
  it.each(rejected)('%s', (_name, source, returnTo, ticket) => {
    expect(sanitizeTicketNavReturnTo(source, returnTo, ticket)).toBe('')
  })
})

describe('readTicketNavContext — state ссылки не доверенный', () => {
  it('принимает корректный контекст', () => {
    const state = { mobileListOrigin: 'chat', ticketNav: ctx('chats', '/m/chats/t-9', 7) }
    expect(readTicketNavContext(state, MOBILE_TICKET)).toEqual(ctx('chats', '/m/chats/t-9', 7))
  })

  it.each([
    ['нет state', null],
    ['state не объект', 'ticketNav'],
    ['нет ticketNav', { boardContext: {} }],
    ['другая версия', { ticketNav: { ...ctx('board', '/board'), v: 2 } }],
    ['неизвестный источник', { ticketNav: { ...ctx('board', '/board'), source: 'admin' } }],
    ['недопустимый returnTo', { ticketNav: ctx('board', 'https://evil.example/board') }],
  ])('отклоняет: %s', (_name, state) => {
    expect(readTicketNavContext(state, DESKTOP_TICKET)).toBeUndefined()
  })

  it('битые originIdx и originKey не ломают контекст, а отключают возврат по истории', () => {
    const state = { ticketNav: { ...ctx('board', '/board'), originIdx: -1, originKey: 42 } }
    expect(readTicketNavContext(state, DESKTOP_TICKET)).toEqual({ v: 1, source: 'board', returnTo: '/board', originKey: '', originIdx: null })
  })

  it('returnTo нормализуется (без лишнего, hash сохраняется)', () => {
    const state = { ticketNav: ctx('board', '/board?boardStatus=NEW#row-5') }
    expect(readTicketNavContext(state, DESKTOP_TICKET)?.returnTo).toBe('/board?boardStatus=NEW#row-5')
  })
})

describe('buildTicketNavContext', () => {
  it('фиксирует точный адрес списка и запись истории', () => {
    const built = buildTicketNavContext({
      source: 'board',
      location: { pathname: '/board', search: '?boardTab=registry&linkedClientCompanyId=c-1', hash: '', key: 'abc' },
      historyIdx: 4,
    })
    expect(built).toEqual({
      v: 1,
      source: 'board',
      returnTo: '/board?boardTab=registry&linkedClientCompanyId=c-1',
      originKey: 'abc',
      originIdx: 4,
    })
    // Карточка принимает то, что построил источник.
    expect(readTicketNavContext({ ticketNav: built }, DESKTOP_TICKET)).toEqual(built)
  })

  it('без history.state.idx возврат по истории невозможен', () => {
    const built = buildTicketNavContext({ source: 'home', location: { pathname: '/m', search: '', key: 'k' }, historyIdx: null })
    expect(built.originIdx).toBeNull()
  })
})

describe('resolveTicketBack — Back и «Назад» ведут в одну запись', () => {
  const fallback = { to: '/board', state: { boardContext: { selectedStatus: 'NEW' } } }

  it('пришли со списка: шаг назад по истории', () => {
    expect(resolveTicketBack(ctx('board', '/board', 3), 4, fallback)).toEqual({ kind: 'history', delta: 1 })
  })

  it('через подзадачу: несколько шагов к тому же списку', () => {
    expect(resolveTicketBack(ctx('my', '/m/my', 3), 5, fallback)).toEqual({ kind: 'history', delta: 2 })
  })

  it('запись источника вне стека (новая вкладка, другой порядок): переход на returnTo с ключом восстановления', () => {
    expect(resolveTicketBack(ctx('chats', '/m/chats', 3), 3, fallback)).toEqual({
      kind: 'navigate',
      to: '/m/chats',
      state: { ticketNavRestoreKey: 'k-src' },
    })
    expect(resolveTicketBack(ctx('chats', '/m/chats', 3), 2, fallback).kind).toBe('navigate')
    expect(resolveTicketBack(ctx('chats', '/m/chats', 3), 30, fallback).kind).toBe('navigate')
    expect(resolveTicketBack(ctx('chats', '/m/chats', null), 4, fallback).kind).toBe('navigate')
    expect(resolveTicketBack(ctx('chats', '/m/chats', 3), null, fallback).kind).toBe('navigate')
  })

  it('без контекста (push, прямая ссылка): прежний адрес по умолчанию', () => {
    expect(resolveTicketBack(undefined, 9, fallback)).toEqual({ kind: 'navigate', to: '/board', state: fallback.state })
  })
})

describe('подписи источника — человеческие, без идентификаторов', () => {
  it.each(TICKET_NAV_SOURCES)('%s', (source) => {
    const label = ticketNavSourceLabel(source)
    expect(label).toMatch(/^[А-ЯЁ][а-яё ]+$/)
    expect(ticketNavOriginCaption(source)).toBe(`Открыто из раздела «${label}»`)
  })

  it('источники из задачи названы', () => {
    expect(TICKET_NAV_SOURCES.map(ticketNavSourceLabel)).toEqual([
      'Заявки',
      'Главная',
      'На приёмке',
      'Мои заявки',
      'Чаты',
      'Обходы',
      'Уведомления',
    ])
  })
})

describe('withTicketNav / stripTicketNav', () => {
  it('добавляет контекст, не теряя полей источника', () => {
    const state = withTicketNav({ mobileListOrigin: 'home' as const, ticketOwnerCompanyId: 'c-1' }, ctx('home', '/m'))
    expect(state).toEqual({ mobileListOrigin: 'home', ticketOwnerCompanyId: 'c-1', ticketNav: ctx('home', '/m') })
  })

  it('убирает контекст из state, который уходит обратно в список', () => {
    expect(stripTicketNav({ mobileListOrigin: 'home', ticketNav: ctx('home', '/m') })).toEqual({ mobileListOrigin: 'home' })
    expect(stripTicketNav({ ticketNav: ctx('home', '/m') })).toBeUndefined()
    expect(stripTicketNav(null)).toBeUndefined()
  })
})

describe('снимок списка в sessionStorage', () => {
  let storage: MemoryStorage
  beforeEach(() => {
    storage = new MemoryStorage()
    ;(globalThis as { window?: unknown }).window = { sessionStorage: storage, localStorage: new MemoryStorage() }
  })
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('возвращает фильтры и прокрутку той же записи', () => {
    saveTicketNavSnapshot('k1', { screen: 'board', pathname: '/board', scrollY: 640, restore: { selectedStatus: 'NEW' } })
    expect(readTicketNavSnapshot('k1', 'board', '/board')).toEqual({
      screen: 'board',
      pathname: '/board',
      scrollY: 640,
      restore: { selectedStatus: 'NEW' },
    })
  })

  it('не применяется к другому экрану или пути под тем же ключом', () => {
    saveTicketNavSnapshot('k1', { screen: 'board', pathname: '/board', scrollY: 640 })
    expect(readTicketNavSnapshot('k1', 'my', '/board')).toBeUndefined()
    expect(readTicketNavSnapshot('k1', 'board', '/tickets')).toBeUndefined()
    expect(readTicketNavSnapshot('k2', 'board', '/board')).toBeUndefined()
  })

  it('битый снимок игнорируется, отрицательная прокрутка обнуляется', () => {
    storage.setItem('sma:ticket-nav:k1', '{not json')
    expect(readTicketNavSnapshot('k1', 'board', '/board')).toBeUndefined()
    storage.setItem('sma:ticket-nav:k2', JSON.stringify({ screen: 'board', pathname: '/board', scrollY: -5 }))
    expect(readTicketNavSnapshot('k2', 'board', '/board')?.scrollY).toBe(0)
  })

  it('хранит ограниченное число снимков', () => {
    for (let i = 0; i < 45; i++) saveTicketNavSnapshot(`k${i}`, { screen: 'board', pathname: '/board', scrollY: i })
    const keys = Array.from(storage.map.keys()).filter((k) => k !== 'sma:ticket-nav:index')
    expect(keys).toHaveLength(40)
    expect(readTicketNavSnapshot('k0', 'board', '/board')).toBeUndefined()
    expect(readTicketNavSnapshot('k44', 'board', '/board')?.scrollY).toBe(44)
  })

  it('без sessionStorage ничего не падает', () => {
    delete (globalThis as { window?: unknown }).window
    expect(() => saveTicketNavSnapshot('k1', { screen: 'board', pathname: '/board', scrollY: 1 })).not.toThrow()
    expect(readTicketNavSnapshot('k1', 'board', '/board')).toBeUndefined()
  })
})

describe('readTicketNavRestoreKey', () => {
  it('читает только строковый ключ', () => {
    expect(readTicketNavRestoreKey({ ticketNavRestoreKey: 'abc' })).toBe('abc')
    expect(readTicketNavRestoreKey({ ticketNavRestoreKey: 5 })).toBe('')
    expect(readTicketNavRestoreKey(null)).toBe('')
  })
})
