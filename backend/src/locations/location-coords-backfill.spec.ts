import {
  decideBackfill,
  lacksAddressAndCoords,
  needsGeocode,
  type BackfillLocationRow,
} from './location-coords-backfill'

function row(patch: Partial<BackfillLocationRow>): BackfillLocationRow {
  return {
    id: 'loc-1',
    clientCompanyId: 'client-1',
    name: 'Точка',
    city: 'Кемерово',
    address: 'Советский проспект, 54',
    latitude: null,
    longitude: null,
    ...patch,
  }
}

describe('needsGeocode', () => {
  it('selects a location with an address and no coordinates', () => {
    expect(needsGeocode(row({}))).toBe(true)
  })

  it('selects a location with only one coordinate', () => {
    expect(needsGeocode(row({ latitude: 55.35 }))).toBe(true)
    expect(needsGeocode(row({ longitude: 86.08 }))).toBe(true)
  })

  it('skips a location whose both coordinates are set', () => {
    expect(needsGeocode(row({ latitude: 55.35, longitude: 86.08 }))).toBe(false)
  })

  it('skips a location without an address, even with a city', () => {
    expect(needsGeocode(row({ address: null }))).toBe(false)
    expect(needsGeocode(row({ address: '   ' }))).toBe(false)
  })
})

describe('lacksAddressAndCoords', () => {
  it('lists a location with neither address nor coordinates', () => {
    expect(lacksAddressAndCoords(row({ address: null }))).toBe(true)
    expect(lacksAddressAndCoords(row({ address: '  ', city: null }))).toBe(true)
  })

  it('does not list a location that has an address or any coordinate', () => {
    expect(lacksAddressAndCoords(row({}))).toBe(false)
    expect(lacksAddressAndCoords(row({ address: null, latitude: 55.35 }))).toBe(false)
  })
})

describe('decideBackfill', () => {
  const hit = { lat: 55.3556, lon: 86.0862, fullName: 'Кемерово, Советский проспект, 54', matchCount: 1 }

  it('writes a single exact or number hit', () => {
    expect(decideBackfill({ ...hit, precision: 'exact' })).toEqual({
      kind: 'write',
      latitude: 55.3556,
      longitude: 86.0862,
      precision: 'exact',
    })
    expect(decideBackfill({ ...hit, precision: 'number' })).toMatchObject({ kind: 'write' })
  })

  it('rejects a missing hit', () => {
    expect(decideBackfill(null)).toEqual({ kind: 'reject', reason: 'not_found', precision: null, matchCount: 0 })
  })

  it('rejects a neighbouring house, a street and other weak matches', () => {
    for (const precision of ['near', 'street', 'other', null] as const) {
      expect(decideBackfill({ ...hit, precision })).toMatchObject({ kind: 'reject', reason: 'weak_precision' })
    }
  })

  it('rejects an exact hit when 2GIS returned several buildings', () => {
    expect(decideBackfill({ ...hit, precision: 'exact', matchCount: 3 })).toEqual({
      kind: 'reject',
      reason: 'ambiguous',
      precision: 'exact',
      matchCount: 3,
    })
  })
})
