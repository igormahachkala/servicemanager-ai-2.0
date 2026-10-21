import { describe, expect, it } from 'vitest'

import {
  LOCATION_ROUTE_LABELS_MAX,
  locationRouteLabels,
  pickLocationRouteTickets,
} from './useLocationRouteLabels'
import { formatTicketRouteLabel } from './MobileTicketRouteDuration'

const loc = (id: string) => ({ id, name: id })

describe('formatTicketRouteLabel', () => {
  it('formats kilometres without minutes', () => {
    expect(formatTicketRouteLabel(9800)).toBe('До объекта · 9,8 км')
  })

  it('formats short distances in meters without minutes', () => {
    expect(formatTicketRouteLabel(45)).toBe('До объекта · 45 м')
  })
})

describe('pickLocationRouteTickets', () => {
  it('takes the first ticket of each location and skips tickets without a location', () => {
    const picked = pickLocationRouteTickets([
      { id: 't-1', location: loc('loc-a') },
      { id: 't-2', location: loc('loc-a') },
      { id: 't-3', location: null },
      { id: 't-4', location: loc('loc-b') },
    ])

    expect([...picked.entries()]).toEqual([
      ['loc-a', 't-1'],
      ['loc-b', 't-4'],
    ])
  })

  it(`keeps at most ${LOCATION_ROUTE_LABELS_MAX} unique locations`, () => {
    const picked = pickLocationRouteTickets([
      { id: 't-1', location: loc('loc-a') },
      { id: 't-2', location: loc('loc-b') },
      { id: 't-3', location: loc('loc-c') },
      { id: 't-4', location: loc('loc-d') },
      { id: 't-5', location: loc('loc-e') },
    ])

    expect([...picked.keys()]).toEqual(['loc-a', 'loc-b', 'loc-c'])
    expect(picked.size).toBe(LOCATION_ROUTE_LABELS_MAX)
  })
})

describe('locationRouteLabels', () => {
  const picked = new Map([
    ['loc-a', 't-1'],
    ['loc-b', 't-4'],
    ['loc-c', 't-9'],
  ])

  it('labels locations whose ticket has a distance, ignoring durationSeconds', () => {
    const labels = locationRouteLabels(picked, {
      't-1': { available: true, distanceMeters: 9800, durationSeconds: null },
      't-4': { available: false, distanceMeters: null, durationSeconds: null },
    })

    expect([...labels.entries()]).toEqual([['loc-a', 'До объекта · 9,8 км']])
  })

  it('returns no labels before routes are loaded', () => {
    expect(locationRouteLabels(picked, undefined).size).toBe(0)
  })
})
