import { DadataSuggestService, parseSuggestHits } from './dadata-suggest.service'

describe('parseSuggestHits', () => {
  it('maps value, unrestricted_value, city and coordinates', () => {
    expect(
      parseSuggestHits({
        suggestions: [
          {
            value: 'ул Ленина, д 1',
            unrestricted_value: 'г Екатеринбург, ул Ленина, д 1',
            data: {
              city: 'Екатеринбург',
              street_with_type: 'ул Ленина',
              house: '1',
              geo_lat: '56.838',
              geo_lon: '60.597',
              qc_geo: 0,
            },
          },
        ],
      }),
    ).toEqual([
      {
        text: 'ул Ленина, 1',
        fullName: 'г Екатеринбург, ул Ленина, д 1',
        city: 'Екатеринбург',
        latitude: 56.838,
        longitude: 60.597,
        qcGeo: 0,
      },
    ])
  })

  it('returns an empty list for a malformed body', () => {
    expect(parseSuggestHits(null)).toEqual([])
    expect(parseSuggestHits({})).toEqual([])
  })
})

describe('DadataSuggestService', () => {
  beforeEach(() => {
    process.env.DADATA_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    delete process.env.DADATA_API_KEY
  })

  it('posts to suggest/address with Authorization Token and city filter', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            value: 'пр-кт Ленина, д 24а',
            unrestricted_value: 'г Екатеринбург, пр-кт Ленина, д 24а',
            data: {
              city: 'Екатеринбург',
              street_with_type: 'пр-кт Ленина',
              house: '24а',
              geo_lat: '56.84',
              geo_lon: '60.6',
              qc_geo: 1,
            },
          },
        ],
      }),
    })
    const service = new DadataSuggestService(fetchImpl as unknown as typeof fetch)

    await expect(service.suggestAddress({ q: 'Ленина 24', city: 'Екатеринбург' })).resolves.toEqual([
      {
        text: 'пр-кт Ленина, 24а',
        fullName: 'г Екатеринбург, пр-кт Ленина, д 24а',
        city: 'Екатеринбург',
        latitude: 56.84,
        longitude: 60.6,
        qcGeo: 1,
      },
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Token test-api-key')
    expect(init.headers['X-Secret']).toBeUndefined()
    expect(JSON.parse(init.body)).toEqual({
      query: 'Ленина 24',
      count: 10,
      locations: [{ city: 'Екатеринбург' }],
      locations_boost: [{ city: 'Екатеринбург' }],
    })
  })

  it('returns an empty list for a short query without calling Dadata', async () => {
    const fetchImpl = jest.fn()
    const service = new DadataSuggestService(fetchImpl as unknown as typeof fetch)

    await expect(service.suggestAddress({ q: 'Л' })).resolves.toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns an empty list when DADATA_API_KEY is missing', async () => {
    delete process.env.DADATA_API_KEY
    const fetchImpl = jest.fn()
    const service = new DadataSuggestService(fetchImpl as unknown as typeof fetch)

    await expect(service.suggestAddress({ q: 'Ленина 24' })).resolves.toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('serves a repeated query from the in-process cache', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    })
    const service = new DadataSuggestService(fetchImpl as unknown as typeof fetch)

    await service.suggestAddress({ q: 'Ленина 24', city: 'Кемерово' })
    await service.suggestAddress({ q: 'Ленина 24', city: 'Кемерово' })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
