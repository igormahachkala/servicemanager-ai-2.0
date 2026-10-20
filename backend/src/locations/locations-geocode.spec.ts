import {
  coordsFromGeocodeHit,
  decideGeocodeIntent,
  isAcceptedQcGeo,
} from './location-geocode'

describe('location-geocode qc_geo', () => {
  it('accepts qc_geo 0 and 1', () => {
    expect(isAcceptedQcGeo(0)).toBe(true)
    expect(isAcceptedQcGeo(1)).toBe(true)
    expect(
      coordsFromGeocodeHit({
        lat: 56.838,
        lon: 60.597,
        qcGeo: 0,
        fullName: 'г Екатеринбург, ул Ленина, д 1',
      }),
    ).toEqual({ latitude: 56.838, longitude: 60.597 })
    expect(
      coordsFromGeocodeHit({
        lat: 55.75,
        lon: 37.61,
        qcGeo: 1,
        fullName: 'г Москва, ул Тверская, д 1',
      }),
    ).toEqual({ latitude: 55.75, longitude: 37.61 })
  })

  it('rejects qc_geo ≥ 2 and null', () => {
    expect(isAcceptedQcGeo(2)).toBe(false)
    expect(isAcceptedQcGeo(3)).toBe(false)
    expect(isAcceptedQcGeo(null)).toBe(false)
    expect(isAcceptedQcGeo(undefined)).toBe(false)
    expect(
      coordsFromGeocodeHit({
        lat: 56.838,
        lon: 60.597,
        qcGeo: 2,
        fullName: 'г Екатеринбург',
      }),
    ).toBeNull()
    expect(
      coordsFromGeocodeHit({
        lat: 56.838,
        lon: 60.597,
        qcGeo: null,
        fullName: 'ул Ленина',
      }),
    ).toBeNull()
    expect(coordsFromGeocodeHit(null)).toBeNull()
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

  it('asks Dadata when create has address and no coords', () => {
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
