import { getBaseUrl, getToken } from './api'

export type ShiftGeoPoint = {
  latitude: number
  longitude: number
  capturedAt?: string
  accuracy?: number
}

export async function postMyShiftGeo(point: ShiftGeoPoint): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${getBaseUrl()}/workforce/me/geo`, {
    method: 'POST',
    headers,
    body: JSON.stringify(point),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** One GPS read and one POST. The caller does not wait, and a GPS refusal does not throw. */
export function postMyShiftGeoQuietly(): void {
  try {
    const geo = typeof navigator === 'undefined' ? undefined : navigator.geolocation
    if (!geo?.getCurrentPosition) return

    geo.getCurrentPosition(
      (position) => {
        const accuracy = position.coords.accuracy
        void postMyShiftGeo({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          capturedAt: new Date(position.timestamp).toISOString(),
          ...(Number.isFinite(accuracy) ? { accuracy } : {}),
        }).catch(() => undefined)
      },
      () => undefined,
    )
  } catch {
    return
  }
}
