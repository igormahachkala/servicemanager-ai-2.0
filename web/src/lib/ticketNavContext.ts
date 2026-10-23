import { safeGetItem, safeReadJson, safeRemoveItem, safeWriteJson } from './browserStorage'
import { sanitizeInternalAppPath } from './returnToNavigation'

/**
 * TUX-01…04: единый контекст перехода «список → карточка заявки».
 *
 * Источник кладёт в location.state ссылки на заявку объект `ticketNav`:
 * откуда открыли (source), точный адрес списка (returnTo) и позицию этой
 * записи в истории браузера (originIdx, originKey). Карточка по нему:
 *  - подписывает источник человеческим названием вместо технического бейджа;
 *  - на «Назад» возвращается в ту же запись истории (history.go(-n)), а если
 *    её в стеке нет — открывает returnTo и просит источник восстановиться.
 *
 * Состояние списка (фильтры, вкладка, поиск, прокрутка) живёт в sessionStorage
 * под ключом записи истории источника. Поэтому браузерные Back/Forward и
 * кнопка «Назад» восстанавливают одно и то же.
 *
 * Контекст — только навигация. Прав он не даёт: returnTo проходит allowlist
 * путей и сверку с разделом источника, а данные на целевой странице снова
 * запрашиваются у сервера с его проверками доступа. Из адресной строки
 * контекст не читается вообще.
 */

export const TICKET_NAV_SOURCES = ['board', 'home', 'acceptance', 'my', 'chats', 'rounds', 'notifications'] as const
export type TicketNavSource = (typeof TICKET_NAV_SOURCES)[number]

export type TicketNavContext = {
  v: 1
  source: TicketNavSource
  /** Путь списка вместе с query и hash. */
  returnTo: string
  /** location.key записи истории источника. */
  originKey: string
  /** history.state.idx записи источника (BrowserRouter). */
  originIdx: number | null
}

export type TicketNavState = { ticketNav?: TicketNavContext }

/** State, с которым карточка открывает список, если вернуться по истории нельзя. */
export type TicketNavRestoreState = { ticketNavRestoreKey: string }

const SOURCE_LABELS: Record<TicketNavSource, string> = {
  board: 'Заявки',
  home: 'Главная',
  acceptance: 'На приёмке',
  my: 'Мои заявки',
  chats: 'Чаты',
  rounds: 'Обходы',
  notifications: 'Уведомления',
}

type Workspace = '' | '/m' | '/max'

/**
 * Разрешённые адреса списка по источнику. Путь берётся без корня раздела
 * (/m, /max); для управленческой части корень пустой.
 */
const SOURCE_PATHS: Record<TicketNavSource, { management: RegExp[]; mobile: RegExp[] }> = {
  board: { management: [/^\/(board|tickets)$/], mobile: [] },
  home: { management: [/^\/dashboard$/], mobile: [/^\/?$/] },
  acceptance: { management: [], mobile: [/^\/?$/] },
  my: { management: [], mobile: [/^\/my$/] },
  chats: { management: [], mobile: [/^\/chats(\/[^/]+)?$/] },
  rounds: {
    management: [/^\/inspection\/runs\/[^/]+(\/report)?$/, /^\/inspection\/quick\/[^/]+$/],
    mobile: [/^\/inspection(\/today|\/start|\/object\/[^/]+|\/[^/]+)?$/],
  },
  notifications: { management: [], mobile: [/^\/notifications$/] },
}

const MAX_HISTORY_DELTA = 20

function workspaceOf(pathname: string): Workspace {
  if (pathname === '/max' || pathname.startsWith('/max/')) return '/max'
  if (pathname === '/m' || pathname.startsWith('/m/')) return '/m'
  return ''
}

function isTicketSource(value: unknown): value is TicketNavSource {
  return typeof value === 'string' && (TICKET_NAV_SOURCES as readonly string[]).includes(value)
}

export function ticketNavSourceLabel(source: TicketNavSource): string {
  return SOURCE_LABELS[source]
}

/** Подпись источника на карточке. */
export function ticketNavOriginCaption(source: TicketNavSource): string {
  return `Открыто из раздела «${SOURCE_LABELS[source]}»`
}

/**
 * returnTo годен, если это внутренний путь из allowlist, он лежит в том же
 * разделе (управление, /m, /max), что и карточка, и совпадает с одним из
 * адресов своего источника. Карточка заявки списком не считается.
 */
export function sanitizeTicketNavReturnTo(source: TicketNavSource, returnTo: unknown, ticketPathname: string): string {
  if (typeof returnTo !== 'string') return ''
  const safe = sanitizeInternalAppPath(returnTo)
  if (!safe) return ''
  const pathname = new URL(safe, 'https://servicemanager.local').pathname
  const workspace = workspaceOf(pathname)
  if (workspace !== workspaceOf(ticketPathname)) return ''
  const rest = workspace ? pathname.slice(workspace.length) : pathname
  const patterns = workspace ? SOURCE_PATHS[source].mobile : SOURCE_PATHS[source].management
  if (!patterns.some((re) => re.test(rest))) return ''
  return safe
}

export function readTicketNavContext(state: unknown, ticketPathname: string): TicketNavContext | undefined {
  if (!state || typeof state !== 'object') return undefined
  const raw = (state as TicketNavState).ticketNav as Partial<TicketNavContext> | undefined
  if (!raw || typeof raw !== 'object' || raw.v !== 1 || !isTicketSource(raw.source)) return undefined
  const returnTo = sanitizeTicketNavReturnTo(raw.source, raw.returnTo, ticketPathname)
  if (!returnTo) return undefined
  const originKey = typeof raw.originKey === 'string' ? raw.originKey.trim().slice(0, 64) : ''
  const originIdx = typeof raw.originIdx === 'number' && Number.isInteger(raw.originIdx) && raw.originIdx >= 0 ? raw.originIdx : null
  return { v: 1, source: raw.source, returnTo, originKey, originIdx }
}

export function buildTicketNavContext(input: {
  source: TicketNavSource
  location: { pathname: string; search: string; hash?: string; key: string }
  historyIdx: number | null | undefined
}): TicketNavContext {
  const { location } = input
  return {
    v: 1,
    source: input.source,
    returnTo: `${location.pathname}${location.search}${location.hash || ''}`,
    originKey: location.key,
    originIdx: typeof input.historyIdx === 'number' && Number.isInteger(input.historyIdx) ? input.historyIdx : null,
  }
}

/** Добавить контекст к state ссылки, не трогая остальные поля источника. */
export function withTicketNav<T extends object>(state: T | null | undefined, ctx: TicketNavContext): T & TicketNavState {
  return { ...(state || ({} as T)), ticketNav: ctx }
}

/** Убрать контекст из state, который карточка передаёт дальше в список. */
export function stripTicketNav<T extends object>(state: T | null | undefined): T | undefined {
  if (!state || typeof state !== 'object') return undefined
  const next = { ...state } as T & TicketNavState
  delete next.ticketNav
  return Object.keys(next).length ? (next as T) : undefined
}

export type TicketBackAction =
  | { kind: 'history'; delta: number }
  | { kind: 'navigate'; to: string; state?: unknown }

/**
 * Как вернуться из карточки. Если запись источника ещё в стеке истории
 * (мы пришли из неё ссылками вперёд), возвращаемся в неё же: так совпадают
 * кнопка «Назад» и браузерный Back. Иначе — новый переход на returnTo
 * с ключом восстановления; без контекста — прежний адрес по умолчанию.
 */
export function resolveTicketBack(
  ctx: TicketNavContext | undefined,
  currentIdx: number | null | undefined,
  fallback: { to: string; state?: unknown },
): TicketBackAction {
  if (!ctx) return { kind: 'navigate', to: fallback.to, state: fallback.state }
  if (ctx.originIdx !== null && typeof currentIdx === 'number') {
    const delta = currentIdx - ctx.originIdx
    if (delta >= 1 && delta <= MAX_HISTORY_DELTA) return { kind: 'history', delta }
  }
  const state: TicketNavRestoreState | undefined = ctx.originKey ? { ticketNavRestoreKey: ctx.originKey } : undefined
  return { kind: 'navigate', to: ctx.returnTo, state }
}

export function currentHistoryIdx(): number | null {
  if (typeof window === 'undefined') return null
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' && Number.isInteger(idx) ? idx : null
}

// --- Снимок списка-источника ---------------------------------------------

const SNAPSHOT_PREFIX = 'sma:ticket-nav:'
const SNAPSHOT_INDEX = 'sma:ticket-nav:index'
const SNAPSHOT_LIMIT = 40

export type TicketNavSnapshot = {
  /** Экран-источник; один экран может отдавать разные source (главная и «На приёмке»). */
  screen: string
  pathname: string
  scrollY: number
  restore?: unknown
}

export function saveTicketNavSnapshot(key: string, snapshot: TicketNavSnapshot) {
  if (!key) return
  safeWriteJson('session', `${SNAPSHOT_PREFIX}${key}`, snapshot)
  const index = safeReadJson<string[]>('session', SNAPSHOT_INDEX, [])
  const list = Array.isArray(index) ? index.filter((k) => typeof k === 'string' && k !== key) : []
  list.push(key)
  while (list.length > SNAPSHOT_LIMIT) {
    const evicted = list.shift()
    if (evicted) safeRemoveItem('session', `${SNAPSHOT_PREFIX}${evicted}`)
  }
  safeWriteJson('session', SNAPSHOT_INDEX, list)
}

/**
 * Снимок применяется только к тому же экрану на том же пути: ключ
 * записи истории без сверки пути мог бы принести фильтры другого экрана.
 */
export function readTicketNavSnapshot(key: string, screen: string, pathname: string): TicketNavSnapshot | undefined {
  if (!key || !safeGetItem('session', `${SNAPSHOT_PREFIX}${key}`)) return undefined
  const raw = safeReadJson<Partial<TicketNavSnapshot> | null>('session', `${SNAPSHOT_PREFIX}${key}`, null)
  if (!raw || typeof raw !== 'object') return undefined
  if (raw.screen !== screen || raw.pathname !== pathname) return undefined
  const scrollY = Number(raw.scrollY)
  return {
    screen,
    pathname,
    scrollY: Number.isFinite(scrollY) && scrollY > 0 ? Math.trunc(scrollY) : 0,
    restore: raw.restore,
  }
}

export function readTicketNavRestoreKey(state: unknown): string {
  if (!state || typeof state !== 'object') return ''
  const key = (state as Partial<TicketNavRestoreState>).ticketNavRestoreKey
  return typeof key === 'string' ? key.trim().slice(0, 64) : ''
}
