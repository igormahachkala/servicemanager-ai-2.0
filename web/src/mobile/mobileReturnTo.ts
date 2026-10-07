import { getMobileRouteRoot } from './mobileRoute'

export type MobileReturnState = { returnTo: string }

/** Путь и query экрана, который открыт в момент перехода. */
export function mobileReturnToState(pathname: string, search: string): MobileReturnState {
  const query = search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : ''
  return { returnTo: `${pathname}${query}` }
}

function pathOnly(value: string): string {
  const path = value.split('#')[0].split('?')[0]
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1)
  return path
}

/**
 * Принять returnTo только если это путь того же мобильного корня и не текущая страница.
 * Иначе запасной адрес, который собирает вызывающий (главная с текущим scope).
 */
export function resolveMobileReturnTo(input: {
  pathname: string
  returnTo: unknown
  fallback: string
}): string {
  if (typeof input.returnTo !== 'string') return input.fallback
  const raw = input.returnTo.trim()
  if (!raw || raw.includes('\\') || raw.includes('://') || raw.startsWith('//')) return input.fallback

  const path = pathOnly(raw)
  const root = getMobileRouteRoot(input.pathname)
  if (path !== root && !path.startsWith(`${root}/`)) return input.fallback
  if (pathOnly(input.pathname) === path) return input.fallback

  const withoutHash = raw.split('#')[0]
  const queryAt = withoutHash.indexOf('?')
  const query = queryAt >= 0 ? withoutHash.slice(queryAt) : ''
  return `${path}${query}`
}
