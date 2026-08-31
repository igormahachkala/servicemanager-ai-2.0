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

export const MAX_AUTH_TIMEOUT_MS = 12_000

export const MAX_APP_ERROR_TITLE = 'Не удалось загрузить приложение'
export const MAX_APP_ERROR_MESSAGE = 'Проверьте соединение и повторите попытку.'
export const MAX_CONTEXT_UNAVAILABLE_TITLE = 'MAX недоступен'
export const MAX_CONTEXT_UNAVAILABLE_MESSAGE = 'Откройте приложение через MAX или перейдите в ServiceManager.'

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
