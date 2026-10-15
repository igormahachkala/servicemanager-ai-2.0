import { postMyShiftGeo } from '../lib/shiftGeoApi'

export const SHIFT_GEO_INTERVAL_MS = 3 * 60 * 1000

/** Recalculate ticket routes only after the technician moved at least this far. */
export const ROUTE_RECALC_DISTANCE_METERS = 400

/** Client staleTime for route labels; refresh is driven by geo-threshold invalidation. */
export const ROUTE_LABELS_STALE_MS = 20 * 60 * 1000

export type ShiftGeoPoint = {
  latitude: number
  longitude: number
}

const EARTH_RADIUS_M = 6_371_000

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle distance in meters between two WGS84 points. */
export function haversineMeters(a: ShiftGeoPoint, b: ShiftGeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function shouldInvalidateRoutes(
  lastRouteOrigin: ShiftGeoPoint | null,
  next: ShiftGeoPoint,
  thresholdMeters: number = ROUTE_RECALC_DISTANCE_METERS,
): boolean {
  if (!lastRouteOrigin) return true
  return haversineMeters(lastRouteOrigin, next) >= thresholdMeters
}

function documentIsVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

function sendCurrentPoint(onPointSent?: (point: ShiftGeoPoint) => void) {
  if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) return

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const point: ShiftGeoPoint = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }
      void postMyShiftGeo({
        latitude: point.latitude,
        longitude: point.longitude,
        capturedAt: new Date(position.timestamp).toISOString(),
      })
        .then(() => onPointSent?.(point))
        .catch(() => undefined)
    },
    () => undefined,
  )
}

export function startOpenShiftGeolocation(
  onPointSent?: (point: ShiftGeoPoint) => void,
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
    return () => undefined
  }

  let stopped = false

  const tick = () => {
    if (stopped) return
    if (!documentIsVisible()) return
    sendCurrentPoint(onPointSent)
  }

  tick()
  const timer = window.setInterval(tick, SHIFT_GEO_INTERVAL_MS)

  const onVisibility = () => {
    if (document.visibilityState === 'visible') tick()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }

  return () => {
    stopped = true
    window.clearInterval(timer)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }
}
