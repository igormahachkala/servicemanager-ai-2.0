import { ApiRequestError } from '../lib/api'

export type MobileMutationOperation = 'claim' | 'start' | 'close' | 'request_assignment' | 'assign' | 'other'

const FALLBACK = 'Не удалось выполнить действие'
const NETWORK = 'Нет соединения. Попробуйте позже'
const NOT_FOUND = 'Заявка не найдена или недоступна'
const SPEC = 'Заявка не подходит по специализации'
const ASSIGNED_OTHER = 'Заявку уже назначили другому исполнителю'

/** Сохраняем сырое исключение в консоль для отладки (сообщение на экране — человекочитаемое). */
export function logMobileMutationDebug(e: unknown) {
  try {
    console.debug('[mobileMutation]', e)
  } catch {
    /* ignore */
  }
}

function rawMessage(e: unknown): string {
  if (e instanceof Error) return (e.message || '').trim()
  if (typeof e === 'object' && e !== null && 'message' in e) return String((e as { message?: unknown }).message || '').trim()
  return String(e ?? '').trim()
}

function isNetworkError(msg: string): boolean {
  const m = msg.toLowerCase()
  if (m.includes('failed to fetch')) return true
  if (m.includes('networkerror')) return true
  if (m.includes('network request failed')) return true
  if (m.includes('load failed')) return true
  if (m.includes('fetch') && m.includes('aborted')) return true
  if (typeof navigator !== 'undefined' && !navigator.onLine && (m.includes('fetch') || m === '')) return true
  if (/нет сохранённых заявок/i.test(msg)) return true
  return false
}

function looksLikeAlreadyAssigned(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    /уже назначен/.test(msg) ||
    m.includes('already assigned') ||
    m.includes('cannot be assigned in status') ||
    m.includes('ticket cannot be assigned') ||
    /уже назначена или недоступна/i.test(msg)
  )
}

/**
 * Преобразует ошибку мутации в короткий текст для мобильного UI.
 * Не подменяет бизнес-логику claim — только отображение.
 */
export function formatMobileMutationError(
  e: unknown,
  ctx: { operation: MobileMutationOperation; claimBlockedByCategoryPolicy?: boolean },
): string {
  logMobileMutationDebug(e)
  const msg = rawMessage(e)
  if (isNetworkError(msg)) return NETWORK

  if (ctx.claimBlockedByCategoryPolicy && ctx.operation === 'claim') return SPEC

  const status = e instanceof ApiRequestError ? e.status : undefined

  if (looksLikeAlreadyAssigned(msg)) return ASSIGNED_OTHER

  if (ctx.operation === 'claim' && status === 404) return SPEC

  if (status === 404) return NOT_FOUND

  if (ctx.operation === 'claim' && /ticket not found|not available for claim/i.test(msg)) return SPEC

  if (ctx.operation === 'claim' && status === 403) return SPEC

  if (ctx.operation === 'request_assignment' && status === 400 && looksLikeAlreadyAssigned(msg)) return ASSIGNED_OTHER

  return FALLBACK
}
