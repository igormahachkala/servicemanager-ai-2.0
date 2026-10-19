import { request } from './api'

export type PlannerScoreReason = {
  label: string
  weight: number
}

export type PlannerNextWork = {
  kind: 'TICKET' | 'INSPECTION'
  id: string
  ticketId?: string
  scheduleId?: string
  title: string | null
  summary: string | null
  suggestedFirst: boolean
  dispatcherAssigned: boolean
  reasons: PlannerScoreReason[]
  total: number
}

export type PlannerNextObject = {
  locationId: string
  locationName: string
  address: string | null
  clientName: string | null
  reasons: PlannerScoreReason[]
  works: PlannerNextWork[]
}

export type PlannerNextResponse =
  | { shiftOpen: false }
  | {
      shiftOpen: true
      currentLocationId: string | null
      first: PlannerNextObject | null
      next: PlannerNextObject[]
    }

/** Ключ кэша React Query: один расчёт на компанию-клиента за сессию. */
export function plannerMeNextQueryKey(linkedClientCompanyId?: string | null) {
  return ['planner-me-next', (linkedClientCompanyId || '').trim()] as const
}

/**
 * Пока кэш не инвалидирован (claim / смена статуса), повторный заход
 * на ту же компанию-клиента не дергает /planner/me/next.
 */
export const PLANNER_ME_NEXT_CACHE = {
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnMount: false as const,
  refetchOnWindowFocus: false as const,
}

export function getPlannerMeNext(linkedClientCompanyId?: string | null): Promise<PlannerNextResponse> {
  const linked = (linkedClientCompanyId || '').trim()
  const search = new URLSearchParams()
  if (linked) search.set('linkedClientCompanyId', linked)
  const qs = search.toString()
  return request<PlannerNextResponse>(`/planner/me/next${qs ? `?${qs}` : ''}`)
}
