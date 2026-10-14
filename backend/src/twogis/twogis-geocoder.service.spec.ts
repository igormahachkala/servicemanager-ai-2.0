import { TwogisGeocoderService } from './twogis-geocoder.service';

describe('TwogisGeocoderService', () => {
  beforeEach(() => {
    process.env.TWOGIS_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.TWOGIS_API_KEY;
  });

  it('does not call 2GIS when address is missing or blank', async () => {
    const fetchImpl = jest.fn();
    const service = new TwogisGeocoderService(fetchImpl as unknown as typeof fetch);

    await expect(service.geocodeAddress({ city: 'Москва', address: null })).resolves.toBeNull();
    await expect(service.geocodeAddress({ address: '   ' })).resolves.toBeNull();
    await expect(service.geocodeAddress({})).resolves.toBeNull();

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('parses a 200 exact geocode hit from the first item', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: { code: 200 },
        result: {
          items: [
            {
              full_name: 'Москва, улица Каретный ряд, 3',
              address_name: 'улица Каретный ряд, 3',
              point: { lat: 55.770784, lon: 37.609256 },
              search_attributes: {
                dgis_address_details: { precision: 'exact' },
              },
            },
            {
              full_name: 'should not be used',
              point: { lat: 0, lon: 0 },
            },
          ],
        },
      }),
    });
    const service = new TwogisGeocoderService(fetchImpl as unknown as typeof fetch);

    await expect(
      service.geocodeAddress({ city: 'Москва', address: 'улица Каретный ряд, 3' }),
    ).resolves.toEqual({
      lat: 55.770784,
      lon: 37.609256,
      precision: 'exact',
      fullName: 'Москва, улица Каретный ряд, 3',
      addressName: 'улица Каретный ряд, 3',
      matchCount: 2,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(calledUrl.origin + calledUrl.pathname).toBe('https://catalog.api.2gis.com/3.0/items/geocode');
    expect(calledUrl.searchParams.get('q')).toBe('улица Каретный ряд, 3, Москва');
    expect(calledUrl.searchParams.get('type')).toBe('building');
    expect(calledUrl.searchParams.get('locale')).toBe('ru_RU');
    expect(calledUrl.searchParams.get('fields')).toBe(
      'items.point,items.geometry.centroid,items.search_attributes.dgis_address_details',
    );
    expect(calledUrl.searchParams.get('key')).toBe('test-key');
  });

  it('returns a near hit without replacing it with another item', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: { code: 200 },
        result: {
          items: [
            {
              full_name: 'Москва, улица Каретный ряд, 5',
              point: { lat: 55.77, lon: 37.61 },
              search_attributes: {
                dgis_address_details: { precision: 'near' },
              },
            },
          ],
        },
      }),
    });
    const service = new TwogisGeocoderService(fetchImpl as unknown as typeof fetch);

    await expect(service.geocodeAddress({ address: 'улица Каретный ряд, 4' })).resolves.toEqual({
      lat: 55.77,
      lon: 37.61,
      precision: 'near',
      fullName: 'Москва, улица Каретный ряд, 5',
      matchCount: 1,
    });
  });

  it('returns null on HTTP 404 without throwing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ meta: { code: 404 } }),
    });
    const service = new TwogisGeocoderService(fetchImpl as unknown as typeof fetch);

    await expect(service.geocodeAddress({ address: 'нет такого' })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns null when meta.code is 404', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meta: { code: 404 }, result: { items: [] } }),
    });
    const service = new TwogisGeocoderService(fetchImpl as unknown as typeof fetch);

    await expect(service.geocodeAddress({ address: 'нет такого' })).resolves.toBeNull();
  });

  it('returns null when TWOGIS_API_KEY is missing and does not call 2GIS', async () => {
    delete process.env.TWOGIS_API_KEY;
    const fetchImpl = jest.fn();
    const service = new TwogisGeocoderService(fetchImpl as unknown as typeof fetch);

    await expect(service.geocodeAddress({ address: 'улица Каретный ряд, 3' })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null when TWOGIS_API_KEY is empty', async () => {
    process.env.TWOGIS_API_KEY = '   ';
    const fetchImpl = jest.fn();
    const service = new TwogisGeocoderService(fetchImpl as unknown as typeof fetch);

    await expect(service.geocodeAddress({ address: 'улица Каретный ряд, 3' })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
