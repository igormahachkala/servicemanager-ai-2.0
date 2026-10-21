import { ApiRequestError, getBaseUrl, getToken } from './api'

export type LocationAddressSuggestItem = {
  text: string
  fullName: string
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  qcGeo?: number | null
}

const suggestCache = new Map<string, LocationAddressSuggestItem[]>()

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function cacheKey(q: string, city?: string): string {
  return `${(city || '').trim()}|${q.trim()}`
}

export function isAcceptedSuggestQcGeo(qcGeo: number | null | undefined): boolean {
  return qcGeo === 0 || qcGeo === 1
}

export function suggestCoordsFromItem(
  item: LocationAddressSuggestItem,
): { latitude: number; longitude: number } | null {
  if (!isAcceptedSuggestQcGeo(item.qcGeo)) return null
  if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') return null
  return { latitude: item.latitude, longitude: item.longitude }
}

export async function suggestLocationAddress(
  q: string,
  city?: string,
  signal?: AbortSignal,
): Promise<LocationAddressSuggestItem[]> {
  const query = q.trim()
  if (query.length < 2) return []

  const key = cacheKey(query, city)
  const cached = suggestCache.get(key)
  if (cached) return cached

  const params = new URLSearchParams()
  params.set('q', query)
  const cityTrim = (city || '').trim()
  if (cityTrim) params.set('city', cityTrim)

  const res = await fetch(`${getBaseUrl()}/locations/address-suggest?${params.toString()}`, {
    headers: authHeaders(),
    signal,
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

  let items: LocationAddressSuggestItem[] = []
  if (Array.isArray(data)) items = data as LocationAddressSuggestItem[]
  else if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    items = (data as { items: LocationAddressSuggestItem[] }).items
  }

  suggestCache.set(key, items)
  return items
}
