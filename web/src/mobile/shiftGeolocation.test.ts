import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  haversineMeters,
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
  let visibility: DocumentVisibilityState
  let listeners: Map<string, Set<() => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(postMyShiftGeo).mockClear()
    visibility = 'visible'
    listeners = new Map()

    vi.stubGlobal('document', {
      get visibilityState() {
        return visibility
      },
      addEventListener(type: string, handler: () => void) {
        const set = listeners.get(type) ?? new Set()
        set.add(handler)
        listeners.set(type, set)
      },
      removeEventListener(type: string, handler: () => void) {
        listeners.get(type)?.delete(handler)
      },
      dispatchEvent(event: { type: string }) {
        for (const handler of listeners.get(event.type) ?? []) handler()
        return true
      },
    })

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              latitude: ORIGIN.latitude,
              longitude: ORIGIN.longitude,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition)
        },
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

  it('does not post geo while the document is hidden', async () => {
    visibility = 'hidden'

    const stop = startOpenShiftGeolocation()
    await Promise.resolve()
    expect(postMyShiftGeo).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3 * 60 * 1000)
    await Promise.resolve()
    expect(postMyShiftGeo).not.toHaveBeenCalled()

    visibility = 'visible'
    document.dispatchEvent({ type: 'visibilitychange' } as Event)
    await Promise.resolve()
    expect(postMyShiftGeo).toHaveBeenCalledTimes(1)

    stop()
  })
})
