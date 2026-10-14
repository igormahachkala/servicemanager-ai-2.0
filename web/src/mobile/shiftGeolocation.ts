import { postMyShiftGeo } from '../lib/shiftGeoApi'

export const SHIFT_GEO_INTERVAL_MS = 3 * 60 * 1000

function sendCurrentPoint() {
  if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) return

  navigator.geolocation.getCurrentPosition(
    (position) => {
      void postMyShiftGeo({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        capturedAt: new Date(position.timestamp).toISOString(),
      }).catch(() => undefined)
    },
    () => undefined,
  )
}

export function startOpenShiftGeolocation(): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
    return () => undefined
  }

  sendCurrentPoint()
  const timer = window.setInterval(sendCurrentPoint, SHIFT_GEO_INTERVAL_MS)
  return () => window.clearInterval(timer)
}
