export const DADATA_REQUEST_TIMEOUT_MS = 8_000

export const DADATA_SUGGEST_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'

export const DADATA_CLEAN_URL = 'https://cleaner.dadata.ru/api/v1/clean/address'

export type DadataGeocodeHit = {
  lat: number
  lon: number
  qcGeo: number | null
  fullName: string
}

export type DadataSuggestHit = {
  text: string
  fullName: string
  city: string | null
  latitude: number | null
  longitude: number | null
  qcGeo: number | null
}

export type DadataGeocodeInput = {
  city?: string | null
  address?: string | null
}

export type DadataSuggestInput = {
  q: string
  city?: string | null
}

export function readDadataApiKey(): string | null {
  const raw = process.env.DADATA_API_KEY
  if (typeof raw !== 'string') return null
  const key = raw.trim()
  return key.length > 0 ? key : null
}

export function readDadataSecretKey(): string | null {
  const raw = process.env.DADATA_SECRET_KEY
  if (typeof raw !== 'string') return null
  const key = raw.trim()
  return key.length > 0 ? key : null
}

export function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function readQcGeo(value: unknown): number | null {
  const n = readFiniteNumber(value)
  if (n === null) return null
  return Number.isInteger(n) ? n : null
}

/**
 * POST JSON helper. Returns null on network errors, timeouts, non-OK HTTP,
 * and invalid JSON. Callers must never log Authorization or X-Secret headers.
 */
export async function dadataFetchJson(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<unknown | null> {
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(DADATA_REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
