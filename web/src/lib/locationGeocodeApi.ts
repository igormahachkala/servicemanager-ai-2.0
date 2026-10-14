import { ApiRequestError, getBaseUrl, getToken } from './api'

export type LocationAddressSuggestItem = {
  text: string
  fullName: string
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function suggestLocationAddress(
  q: string,
  city?: string,
): Promise<LocationAddressSuggestItem[]> {
  const query = q.trim()
  if (query.length < 2) return []

  const params = new URLSearchParams()
  params.set('q', query)
  const cityTrim = (city || '').trim()
  if (cityTrim) params.set('city', cityTrim)

  const res = await fetch(`${getBaseUrl()}/locations/address-suggest?${params.toString()}`, {
    headers: authHeaders(),
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
    const payload = data && typeof data === 'object' ? (data as { message?: unknown }) : null
    const message = payload?.message
      ? Array.isArray(payload.message)
        ? payload.message.join(',')
        : String(payload.message)
      : `HTTP ${res.status}`
    throw new ApiRequestError(message, res.status, data)
  }

  if (Array.isArray(data)) return data as LocationAddressSuggestItem[]
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: LocationAddressSuggestItem[] }).items
  }
  return []
}
