export type GeocodeHit = {
  lat: number
  lon: number
  qcGeo: number | null
  fullName: string
} | null

export type GeocodeIntent =
  | { kind: 'skip' }
  | { kind: 'geocode'; city: string | null; address: string }

function normalizeLocationText(value?: string | null): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed ? trimmed : null
}

/** Dadata qc_geo 0 (exact house) and 1 (nearest house) are writable. */
export function isAcceptedQcGeo(qcGeo: number | null | undefined): boolean {
  return qcGeo === 0 || qcGeo === 1
}

export function coordsFromGeocodeHit(hit: GeocodeHit): { latitude: number; longitude: number } | null {
  if (!hit) return null
  if (!isAcceptedQcGeo(hit.qcGeo)) return null
  if (typeof hit.lat !== 'number' || typeof hit.lon !== 'number') return null
  return { latitude: hit.lat, longitude: hit.lon }
}

export function operatorHasCompleteCoords(input: {
  latitude?: number | null
  longitude?: number | null
}): boolean {
  return typeof input.latitude === 'number' && typeof input.longitude === 'number'
}

export function operatorSentCoords(input: {
  latitude?: number | null
  longitude?: number | null
}): boolean {
  return input.latitude !== undefined || input.longitude !== undefined
}

export function decideGeocodeIntent(input: {
  mode: 'create' | 'update'
  city?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  currentCity?: string | null
  currentAddress?: string | null
}): GeocodeIntent {
  if (input.mode === 'create' && operatorHasCompleteCoords(input)) {
    return { kind: 'skip' }
  }
  if (input.mode === 'update' && operatorSentCoords(input)) {
    return { kind: 'skip' }
  }

  const address = normalizeLocationText(input.address)
  if (!address) return { kind: 'skip' }

  const city = normalizeLocationText(input.city)
  if (input.mode === 'update') {
    const currentCity = normalizeLocationText(input.currentCity)
    const currentAddress = normalizeLocationText(input.currentAddress)
    if (city === currentCity && address === currentAddress) return { kind: 'skip' }
  }

  return { kind: 'geocode', city, address }
}
