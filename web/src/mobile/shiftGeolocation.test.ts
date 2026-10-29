import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  haversineMeters,
  SHIFT_GEO_INTERVAL_MS,
  shouldInvalidateRoutes,
  startOpenShiftGeolocation,
  type ShiftGeoPoint,
} from './shiftGeolocation'

vi.mock('../lib/shiftGeoApi', () => ({
  postMyShiftGeo: vi.fn().mockResolvedValue(undefined),
}))

import { postMyShiftGeo } from '../lib/shiftGeoApi'

const ORIGIN: ShiftGeoPoint = { latitude: 55.75, longitude: 37.62 }

/** ~111 m north of ORIGIN at this latitude. */
const NEAR: ShiftGeoPoint = { latitude: 55.751, longitude: 37.62 }

/** ~1.1 km north of ORIGIN. */
const FAR: ShiftGeoPoint = { latitude: 55.76, longitude: 37.62 }

describe('haversineMeters', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineMeters(ORIGIN, ORIGIN)).toBeLessThan(1)
  })

  it('measures roughly one hundred meters for a 0.001° latitude step', () => {
    const meters = haversineMeters(ORIGIN, NEAR)
    expect(meters).toBeGreaterThan(100)
    expect(meters).toBeLessThan(130)
  })
})

describe('shouldInvalidateRoutes', () => {
  it('invalidates on the first point', () => {
    expect(shouldInvalidateRoutes(null, ORIGIN)).toBe(true)
  })

  it('does not invalidate when the shift stays under the threshold', () => {
    expect(shouldInvalidateRoutes(ORIGIN, NEAR, 400)).toBe(false)
  })

  it('invalidates when the shift crosses the threshold', () => {
    expect(shouldInvalidateRoutes(ORIGIN, FAR, 400)).toBe(true)
  })
})

describe('startOpenShiftGeolocation', () => {
  let watchSuccess: PositionCallback | null
  let clearWatch: ReturnType<typeof vi.fn>
  let addEventListener: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(postMyShiftGeo).mockClear()
    watchSuccess = null
    clearWatch = vi.fn()
    addEventListener = vi.fn()

    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener,
      removeEventListener: vi.fn(),
    })

    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: (success: PositionCallback) => {
          watchSuccess = success
          return 7
        },
        clearWatch,
      },
    })

    vi.stubGlobal('window', {
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function emit(latitude: number, longitude: number, accuracy: number, timestamp: number) {
    watchSuccess?.({
      coords: {
        latitude,
        longitude,
        accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp,
    } as GeolocationPosition)
  }

  it('posts the latest watched point with accuracy while the document stays hidden', async () => {
    expect(SHIFT_GEO_INTERVAL_MS).toBe(3 * 60 * 1000)

    const onPointSent = vi.fn()
    const stop = startOpenShiftGeolocation(onPointSent)
    const capturedAt = '2026-10-27T12:00:00.000Z'
    const laterCapturedAt = '2026-10-27T12:03:00.000Z'

    emit(ORIGIN.latitude, ORIGIN.longitude, 12, Date.parse(capturedAt))
    await Promise.resolve()

    expect(postMyShiftGeo).toHaveBeenCalledTimes(1)
    expect(postMyShiftGeo).toHaveBeenCalledWith({
      latitude: ORIGIN.latitude,
      longitude: ORIGIN.longitude,
      capturedAt,
      accuracy: 12,
    })
    expect(onPointSent).toHaveBeenCalledWith(ORIGIN)
    expect(addEventListener).not.toHaveBeenCalled()

    emit(NEAR.latitude, NEAR.longitude, 40, Date.parse(laterCapturedAt))
    await Promise.resolve()
    expect(postMyShiftGeo).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(SHIFT_GEO_INTERVAL_MS)
    await Promise.resolve()

    expect(document.visibilityState).toBe('hidden')
    expect(postMyShiftGeo).toHaveBeenCalledTimes(2)
    expect(postMyShiftGeo).toHaveBeenLastCalledWith({
      latitude: NEAR.latitude,
      longitude: NEAR.longitude,
      capturedAt: laterCapturedAt,
      accuracy: 40,
    })

    stop()
    expect(clearWatch).toHaveBeenCalledWith(7)

    vi.advanceTimersByTime(SHIFT_GEO_INTERVAL_MS)
    await Promise.resolve()
    expect(postMyShiftGeo).toHaveBeenCalledTimes(2)
  })
})
