export const SESSION_TEMPORARY_UNAVAILABLE_MESSAGE = 'Сервис временно недоступен. Повторяем подключение.'

export type SessionState =
  | 'AUTHENTICATED'
  | 'AUTH_EXPIRED'
  | 'NETWORK_ERROR'
  | 'BACKEND_UNAVAILABLE'
  | 'UNKNOWN_ERROR'

const AUTH_INVALID_STATUSES = new Set([401])
const BACKEND_UNAVAILABLE_STATUSES = new Set([502, 503, 504])
const MAX_SESSION_CHECK_RETRIES = 5
const BASE_RETRY_DELAY_MS = 1000
const MAX_RETRY_DELAY_MS = 30_000

function readHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' && Number.isFinite(status) ? status : null
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function isNetworkLikeError(error: unknown): boolean {
  if (!error) return false
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  return (
    name === 'TypeError' ||
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /fetch failed|failed to fetch|networkerror|network error|load failed|cancelled|timeout/i.test(message)
  )
}

export function classifySessionError(error: unknown): Exclude<SessionState, 'AUTHENTICATED'> {
  const status = readHttpStatus(error)
  if (status && AUTH_INVALID_STATUSES.has(status)) return 'AUTH_EXPIRED'
  if (isBrowserOffline()) return 'NETWORK_ERROR'
  if (status && (BACKEND_UNAVAILABLE_STATUSES.has(status) || status >= 500)) return 'BACKEND_UNAVAILABLE'
  if (isNetworkLikeError(error)) return 'NETWORK_ERROR'
  return 'UNKNOWN_ERROR'
}

export function resolveSessionState(params: {
  hasSessionData: boolean
  isError: boolean
  error: unknown
}): SessionState {
  if (!params.isError) return 'AUTHENTICATED'
  if (params.hasSessionData) {
    const state = classifySessionError(params.error)
    return state === 'AUTH_EXPIRED' ? 'AUTH_EXPIRED' : state
  }
  return classifySessionError(params.error)
}

export function shouldClearTokenForSessionError(error: unknown): boolean {
  return classifySessionError(error) === 'AUTH_EXPIRED'
}

export function isTransientSessionState(state: SessionState): boolean {
  return state === 'NETWORK_ERROR' || state === 'BACKEND_UNAVAILABLE' || state === 'UNKNOWN_ERROR'
}

export function shouldRetrySessionCheck(failureCount: number, error: unknown): boolean {
  if (shouldClearTokenForSessionError(error)) return false
  return failureCount < MAX_SESSION_CHECK_RETRIES
}

export function sessionCheckRetryDelay(attemptIndex: number): number {
  const delay = BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attemptIndex)
  return Math.min(MAX_RETRY_DELAY_MS, delay)
}

export const sessionCheckQueryOptions = {
  retry: shouldRetrySessionCheck,
  retryDelay: sessionCheckRetryDelay,
  refetchOnReconnect: true,
  refetchOnWindowFocus: true,
}

export function buildLoginReturnPath(pathname: string, search = '', hash = ''): string {
  const path = `${pathname || '/'}${search || ''}${hash || ''}`
  if (!path.startsWith('/') || path.startsWith('//')) return '/workspaces'
  if (path === '/login' || path.startsWith('/login?') || path === '/logout' || path.startsWith('/logout?')) {
    return '/workspaces'
  }
  return path
}

export function buildLoginPathWithReturnTo(pathname: string, search = '', hash = ''): string {
  const returnTo = buildLoginReturnPath(pathname, search, hash)
  const params = new URLSearchParams()
  if (returnTo !== '/workspaces') params.set('returnTo', returnTo)
  const qs = params.toString()
  return `/login${qs ? `?${qs}` : ''}`
}

export function readSafeLoginReturnTo(raw: string | null | undefined): string {
  const value = (raw || '').trim()
  if (!value) return ''
  if (!value.startsWith('/') || value.startsWith('//')) return ''
  if (value === '/login' || value.startsWith('/login?') || value === '/logout' || value.startsWith('/logout?')) return ''
  return value
}
