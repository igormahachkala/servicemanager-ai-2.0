import { getBaseUrl, getToken } from './api'

export type ShiftGeoPoint = {
  latitude: number
  longitude: number
  capturedAt?: string
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
