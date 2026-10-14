import {
  coordsFromGeocodeHit,
  decideGeocodeIntent,
  isAcceptedGeocodePrecision,
} from './location-geocode'

describe('location-geocode precision', () => {
  it('accepts exact and number', () => {
    expect(isAcceptedGeocodePrecision('exact')).toBe(true)
    expect(isAcceptedGeocodePrecision('number')).toBe(true)
    expect(
      coordsFromGeocodeHit({
        lat: 56.838,
        lon: 60.597,
        precision: 'exact',
        fullName: 'Екатеринбург, ул. Ленина, 1',
      }),
    ).toEqual({ latitude: 56.838, longitude: 60.597 })
    expect(
      coordsFromGeocodeHit({
        lat: 55.75,
        lon: 37.61,
        precision: 'number',
        fullName: 'Москва, Тверская, 1',
      }),
    ).toEqual({ latitude: 55.75, longitude: 37.61 })
  })

  it('rejects near, street and null', () => {
    expect(isAcceptedGeocodePrecision('near')).toBe(false)
    expect(isAcceptedGeocodePrecision('street')).toBe(false)
    expect(isAcceptedGeocodePrecision('other')).toBe(false)
    expect(isAcceptedGeocodePrecision(null)).toBe(false)
    expect(
      coordsFromGeocodeHit({
        lat: 56.838,
        lon: 60.597,
        precision: 'near',
        fullName: 'Екатеринбург',
      }),
    ).toBeNull()
    expect(
      coordsFromGeocodeHit({
        lat: 56.838,
        lon: 60.597,
        precision: 'street',
        fullName: 'ул. Ленина',
      }),
    ).toBeNull()
    expect(coordsFromGeocodeHit(null)).toBeNull()
    expect(
      coordsFromGeocodeHit({
        lat: 56.838,
        lon: 60.597,
        precision: null,
        fullName: 'Екатеринбург, ул. Ленина, 1',
      }),
    ).toBeNull()
  })
})

describe('location-geocode decideGeocodeIntent', () => {
  it('skips geocode when operator already provided coords', () => {
    expect(
      decideGeocodeIntent({
        mode: 'create',
        city: 'Екатеринбург',
        address: 'ул. Ленина, 1',
        latitude: 56.8,
        longitude: 60.6,
      }),
    ).toEqual({ kind: 'skip' })

    expect(
      decideGeocodeIntent({
        mode: 'update',
        city: 'Екатеринбург',
        address: 'ул. Ленина, 2',
        currentCity: 'Екатеринбург',
        currentAddress: 'ул. Ленина, 1',
        latitude: 56.8,
        longitude: 60.6,
      }),
    ).toEqual({ kind: 'skip' })
  })

  it('skips geocode when address is empty', () => {
    expect(
      decideGeocodeIntent({
        mode: 'create',
        city: 'Екатеринбург',
        address: '   ',
      }),
    ).toEqual({ kind: 'skip' })

    expect(
      decideGeocodeIntent({
        mode: 'update',
        city: 'Екатеринбург',
        address: null,
        currentCity: 'Екатеринбург',
        currentAddress: 'ул. Ленина, 1',
      }),
    ).toEqual({ kind: 'skip' })
  })

  it('asks 2GIS when create has address and no coords', () => {
    expect(
      decideGeocodeIntent({
        mode: 'create',
        city: 'Екатеринбург',
        address: 'ул. Ленина, 1',
      }),
    ).toEqual({ kind: 'geocode', city: 'Екатеринбург', address: 'ул. Ленина, 1' })
  })

  it('skips geocode on name-only update', () => {
    expect(
      decideGeocodeIntent({
        mode: 'update',
        city: 'Екатеринбург',
        address: 'ул. Ленина, 1',
        currentCity: 'Екатеринбург',
        currentAddress: 'ул. Ленина, 1',
      }),
    ).toEqual({ kind: 'skip' })
  })
})
