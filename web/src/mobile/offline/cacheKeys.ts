/**
 * Общие ключи scope для кэша доски и детальной карточки.
 * Формат совпадает с legacy localStorage (`offlineQueue.ts`), чтобы migrate
 * перенёс записи один в один.
 */

export type TicketScopeLike = {
  companyId?: string
  linkedClientCompanyId?: string
}

export function normalizeTicketScope(scope?: TicketScopeLike): TicketScopeLike {
  return {
    companyId: (scope?.companyId || '').trim() || undefined,
    linkedClientCompanyId: (scope?.linkedClientCompanyId || '').trim() || undefined,
  }
}

export function boardCacheScopeKey(scope?: TicketScopeLike): string {
  return JSON.stringify(normalizeTicketScope(scope))
}

export function ticketDetailCacheKey(ticketId: string, scope?: TicketScopeLike): string {
  return `${ticketId}::${boardCacheScopeKey(scope)}`
}
