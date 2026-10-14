import type { TwogisGeocodeHit, TwogisPrecision } from '../twogis/twogis.types'
import { isAcceptedGeocodePrecision } from './location-geocode'

export type BackfillLocationRow = {
  id: string
  clientCompanyId: string
  name: string
  city: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
}

export type BackfillRejectReason = 'not_found' | 'weak_precision' | 'ambiguous'

export type BackfillDecision =
  | { kind: 'write'; latitude: number; longitude: number; precision: TwogisPrecision }
  | { kind: 'reject'; reason: BackfillRejectReason; precision: TwogisPrecision | null; matchCount: number }

function hasText(value: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasCompleteCoords(row: BackfillLocationRow): boolean {
  return typeof row.latitude === 'number' && typeof row.longitude === 'number'
}

/** Address present, at least one coordinate missing. City alone is not enough for 2GIS. */
export function needsGeocode(row: BackfillLocationRow): boolean {
  return hasText(row.address) && !hasCompleteCoords(row)
}

/** No address and no coordinates at all: nothing to geocode, a human must supply the address. */
export function lacksAddressAndCoords(row: BackfillLocationRow): boolean {
  return !hasText(row.address) && row.latitude === null && row.longitude === null
}

export function decideBackfill(hit: TwogisGeocodeHit | null): BackfillDecision {
  if (!hit) return { kind: 'reject', reason: 'not_found', precision: null, matchCount: 0 }
  if (!isAcceptedGeocodePrecision(hit.precision) || hit.precision === null) {
    return { kind: 'reject', reason: 'weak_precision', precision: hit.precision, matchCount: hit.matchCount }
  }
  if (hit.matchCount > 1) {
    return { kind: 'reject', reason: 'ambiguous', precision: hit.precision, matchCount: hit.matchCount }
  }
  return { kind: 'write', latitude: hit.lat, longitude: hit.lon, precision: hit.precision }
}
