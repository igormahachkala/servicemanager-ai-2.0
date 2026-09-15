import { sanitizeInternalAppPath } from '../lib/returnToNavigation'
import { parseStartParam, type MaxEnvironmentContext } from './maxBridge'

export type MaxBootstrapState =
  | 'loading_bridge'
  | 'detecting_context'
  | 'checking_auth'
  | 'unauthenticated'
  | 'authenticated'
  | 'context_unavailable'
  | 'temporary_error'
  | 'account_unavailable'
  | 'max_already_bound'

export const MAX_AUTH_TIMEOUT_MS = 12_000
export const MAX_PENDING_BIND_KEY = 'sma_max_pending_bind'

export const MAX_APP_ERROR_TITLE = 'Не удалось загрузить приложение'
export const MAX_APP_ERROR_MESSAGE = 'Проверьте соединение и повторите попытку.'
export const MAX_CONTEXT_UNAVAILABLE_TITLE = 'MAX недоступен'
export const MAX_CONTEXT_UNAVAILABLE_MESSAGE = 'Откройте приложение через MAX или перейдите в ServiceManager.'
export const MAX_ALREADY_BOUND_TITLE = 'Этот MAX-аккаунт уже привязан'
export const MAX_ALREADY_BOUND_MESSAGE = 'Этот MAX-аккаунт уже привязан к другому пользователю'
export const MAX_ACCOUNT_UNAVAILABLE_TITLE = 'Аккаунт недоступен'
export const MAX_ACCOUNT_UNAVAILABLE_MESSAGE = 'Этот аккаунт нельзя использовать для входа через MAX.'

type MaxReturnToInput = {
  pathname: string
  search?: string
  hash?: string
  startParam?: string | null
}

export function resolveMaxReturnTo(input: MaxReturnToInput): string {
  const parsed = parseStartParam(input.startParam)
  if (parsed.type === 'ticket') {
    return `/max/tickets/${encodeURIComponent(parsed.ticketId)}`
  }

  const current = sanitizeInternalAppPath(`${input.pathname}${input.search || ''}${input.hash || ''}`)
  if (current && current.startsWith('/max')) return current
  return '/max'
}

export function isMaxContextAvailable(context: MaxEnvironmentContext): boolean {
  return context.detected
}

export function hasMaxInitData(context: MaxEnvironmentContext): boolean {
  return Boolean((context.initData || '').trim())
}

export function hasSmaSessionToken(token?: string | null): boolean {
  return Boolean((token || '').trim())
}

export function classifyMaxAuthFailure(err: unknown): 'unauthenticated' | 'temporary_error' {
  const status = typeof (err as { status?: unknown })?.status === 'number'
    ? (err as { status: number }).status
    : null
  if (status === 401 || status === 403) return 'unauthenticated'
  return 'temporary_error'
}

export type MaxSessionDeniedKind = 'not_bound' | 'init_data' | 'account_unavailable' | 'replayed' | 'other'

export function classifyMaxSessionDenied(reason: string | null): MaxSessionDeniedKind {
  if (!reason) return 'other'
  if (reason === 'not_bound') return 'not_bound'
  if (reason.startsWith('init_data_')) return 'init_data'
  if (reason === 'replayed') return 'replayed'
  if (
    reason === 'user_inactive' ||
    reason === 'binding_revoked' ||
    reason === 'binding_suspended' ||
    reason === 'company_mismatch'
  ) {
    return 'account_unavailable'
  }
  return 'other'
}

export function isMaxUserAlreadyBound(reason: string | null): boolean {
  return reason === 'max_user_already_bound'
}

export function markMaxBindPending() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(MAX_PENDING_BIND_KEY, '1')
}

export function takeMaxBindPending(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const pending = sessionStorage.getItem(MAX_PENDING_BIND_KEY) === '1'
  if (pending) sessionStorage.removeItem(MAX_PENDING_BIND_KEY)
  return pending
}
