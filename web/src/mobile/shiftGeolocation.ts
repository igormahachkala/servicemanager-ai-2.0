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

type WatchedShiftFix = {
  latitude: number
  longitude: number
  capturedAt: string
  accuracy?: number
}

function fixFromPosition(position: GeolocationPosition): WatchedShiftFix {
  const accuracy = position.coords.accuracy
  const fix: WatchedShiftFix = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    capturedAt: new Date(position.timestamp).toISOString(),
  }
  if (Number.isFinite(accuracy)) fix.accuracy = accuracy
  return fix
}

export function startOpenShiftGeolocation(
  onPointSent?: (point: ShiftGeoPoint) => void,
): () => void {
  const geo = typeof navigator === 'undefined' ? undefined : navigator.geolocation
  if (!geo?.watchPosition) return () => undefined

  let stopped = false
  let latest: WatchedShiftFix | null = null
  let postedInitial = false

  const publish = () => {
    if (stopped || !latest) return
    const point = latest
    void postMyShiftGeo(point)
      .then(() => onPointSent?.({ latitude: point.latitude, longitude: point.longitude }))
      .catch(() => undefined)
  }

  const watchId = geo.watchPosition(
    (position) => {
      if (stopped) return
      latest = fixFromPosition(position)
      if (postedInitial) return
      postedInitial = true
      publish()
    },
    () => undefined,
  )

  const timer = window.setInterval(publish, SHIFT_GEO_INTERVAL_MS)

  return () => {
    stopped = true
    window.clearInterval(timer)
    geo.clearWatch(watchId)
  }
}
