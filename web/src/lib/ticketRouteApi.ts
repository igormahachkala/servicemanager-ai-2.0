import { getBaseUrl, getToken, type TicketScopeParams } from './api'

export type TicketRouteResponse = {
  available: boolean
  distanceMeters: number | null
  /** Always null from the API. Straight-line distance has no travel time. */
  durationSeconds: number | null
}

export type TicketRoutesResponse = Record<string, TicketRouteResponse>

export const TICKET_ROUTES_BATCH_MAX = 50

function ticketRouteUrl(path: string, scope?: TicketScopeParams): string {
  const search = new URLSearchParams()
  if (scope?.companyId) search.set('companyId', scope.companyId)
  if (scope?.linkedClientCompanyId) {
    search.set('linkedClientCompanyId', scope.linkedClientCompanyId)
  }
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return `${getBaseUrl()}${path}${suffix}`
}

async function requestTicketRoute<T>(url: string, init: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const payload = data as { message?: string | string[] } | null
    const message = payload?.message
      ? Array.isArray(payload.message)
        ? payload.message.join(',')
        : String(payload.message)
      : `HTTP ${res.status}`
    throw new Error(message)
  }

  return data as T
}

export async function getTicketRoute(
  id: string,
  scope?: TicketScopeParams,
): Promise<TicketRouteResponse> {
  return requestTicketRoute<TicketRouteResponse>(ticketRouteUrl(`/tickets/${id}/route`, scope), {
    method: 'GET',
  })
}

export async function getTicketRoutes(
  ticketIds: string[],
  scope?: TicketScopeParams,
): Promise<TicketRoutesResponse> {
  const chunks: string[][] = []
  for (let i = 0; i < ticketIds.length; i += TICKET_ROUTES_BATCH_MAX) {
    chunks.push(ticketIds.slice(i, i + TICKET_ROUTES_BATCH_MAX))
  }
  const parts = await Promise.all(
    chunks.map((chunk) =>
      requestTicketRoute<TicketRoutesResponse>(ticketRouteUrl('/tickets/routes', scope), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketIds: chunk }),
      }),
    ),
  )
  return Object.assign({}, ...parts)
}
