import { DadataGeocoderService, parseCleanHit } from './dadata-geocoder.service'

describe('parseCleanHit', () => {
  it('reads lat, lon and qc_geo from the first clean result', () => {
    expect(
      parseCleanHit([
        {
          source: 'Екатеринбург, ул Ленина, 1',
          result: 'г Екатеринбург, ул Ленина, д 1',
          geo_lat: '56.838011',
          geo_lon: '60.597465',
          qc_geo: 0,
        },
      ]),
    ).toEqual({
      lat: 56.838011,
      lon: 60.597465,
      qcGeo: 0,
      fullName: 'г Екатеринбург, ул Ленина, д 1',
    })
  })

  it('returns null without coordinates', () => {
    expect(parseCleanHit([])).toBeNull()
    expect(parseCleanHit([{ result: 'нет дома', qc_geo: 2 }])).toBeNull()
  })
})

describe('DadataGeocoderService', () => {
  beforeEach(() => {
    process.env.DADATA_API_KEY = 'test-api-key'
    process.env.DADATA_SECRET_KEY = 'test-secret-key'
  })

  afterEach(() => {
    delete process.env.DADATA_API_KEY
    delete process.env.DADATA_SECRET_KEY
  })

  it('does not call cleaner when address is missing or blank', async () => {
    const fetchImpl = jest.fn()
    const service = new DadataGeocoderService(fetchImpl as unknown as typeof fetch)

    await expect(service.geocodeAddress({ city: 'Москва', address: null })).resolves.toBeNull()
    await expect(service.geocodeAddress({ address: '   ' })).resolves.toBeNull()
    await expect(service.geocodeAddress({})).resolves.toBeNull()

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts city+address to cleaner with Token and X-Secret', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          result: 'г Москва, ул Каретный Ряд, д 3',
          geo_lat: '55.770784',
          geo_lon: '37.609256',
          qc_geo: 0,
        },
      ],
    })
    const service = new DadataGeocoderService(fetchImpl as unknown as typeof fetch)

    await expect(
      service.geocodeAddress({ city: 'Москва', address: 'улица Каретный ряд, 3' }),
    ).resolves.toEqual({
      lat: 55.770784,
      lon: 37.609256,
      qcGeo: 0,
      fullName: 'г Москва, ул Каретный Ряд, д 3',
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://cleaner.dadata.ru/api/v1/clean/address')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Token test-api-key')
    expect(init.headers['X-Secret']).toBe('test-secret-key')
    expect(JSON.parse(init.body)).toEqual(['Москва, улица Каретный ряд, 3'])
  })

  it('returns null on HTTP error without throwing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    })
    const service = new DadataGeocoderService(fetchImpl as unknown as typeof fetch)

    await expect(service.geocodeAddress({ address: 'ул Ленина, 1' })).resolves.toBeNull()
  })

  it('returns null when API key or secret is missing', async () => {
    delete process.env.DADATA_SECRET_KEY
    const fetchImpl = jest.fn()
    const service = new DadataGeocoderService(fetchImpl as unknown as typeof fetch)

    await expect(service.geocodeAddress({ address: 'ул Ленина, 1' })).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()

    process.env.DADATA_SECRET_KEY = 'test-secret-key'
    delete process.env.DADATA_API_KEY
    await expect(service.geocodeAddress({ address: 'ул Ленина, 1' })).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
