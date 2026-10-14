import { getBaseUrl, getToken, type TicketScopeParams } from './api'

export type TicketRouteResponse = {
  available: boolean
  distanceMeters: number | null
  durationSeconds: number | null
}

function ticketRouteUrl(id: string, scope?: TicketScopeParams): string {
  const search = new URLSearchParams()
  if (scope?.companyId) search.set('companyId', scope.companyId)
  if (scope?.linkedClientCompanyId) {
    search.set('linkedClientCompanyId', scope.linkedClientCompanyId)
  }
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return `${getBaseUrl()}/tickets/${id}/route${suffix}`
}

export async function getTicketRoute(
  id: string,
  scope?: TicketScopeParams,
): Promise<TicketRouteResponse> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(ticketRouteUrl(id, scope), {
    method: 'GET',
    headers,
  })
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

  return data as TicketRouteResponse
}
