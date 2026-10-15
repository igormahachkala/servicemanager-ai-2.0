import { buildSuggestQuery, TwogisSuggestService } from './twogis-suggest.service';

describe('buildSuggestQuery', () => {
  it('prefixes the city when the query does not mention it', () => {
    expect(buildSuggestQuery('Советский проспект, 54', 'Кемерово')).toBe(
      'Кемерово, Советский проспект, 54',
    );
  });

  it('keeps the query when it already names the city, case-insensitive', () => {
    expect(buildSuggestQuery('кемерово, Советский проспект, 54', 'Кемерово')).toBe(
      'кемерово, Советский проспект, 54',
    );
  });

  it('keeps the query without a city', () => {
    expect(buildSuggestQuery('Советский проспект, 54', '  ')).toBe('Советский проспект, 54');
    expect(buildSuggestQuery('Советский проспект, 54', null)).toBe('Советский проспект, 54');
  });
});

describe('TwogisSuggestService', () => {
  beforeEach(() => {
    process.env.TWOGIS_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.TWOGIS_API_KEY;
  });

  it('uses address_name as text so an organisation name never becomes the address', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: { code: 200 },
        result: {
          items: [
            {
              name: 'Администрация г. Екатеринбурга',
              full_name: 'Екатеринбург, Администрация г. Екатеринбурга',
              address_name: 'проспект Ленина, 24а',
              type: 'building',
            },
            {
              name: 'проспект Ленина, 24/8Б',
              full_name: 'Екатеринбург, проспект Ленина, 24/8Б',
              type: 'building',
            },
          ],
        },
      }),
    });
    const service = new TwogisSuggestService(fetchImpl as unknown as typeof fetch);

    await expect(service.suggestAddress({ q: 'Ленина 24' })).resolves.toEqual([
      {
        text: 'проспект Ленина, 24а',
        fullName: 'Екатеринбург, Администрация г. Екатеринбурга',
      },
      {
        text: 'проспект Ленина, 24/8Б',
        fullName: 'Екатеринбург, проспект Ленина, 24/8Б',
      },
    ]);

    const calledUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(calledUrl.origin + calledUrl.pathname).toBe('https://catalog.api.2gis.com/3.0/suggests');
    expect(calledUrl.searchParams.get('suggest_type')).toBe('address');
    expect(calledUrl.searchParams.get('key')).toBe('test-key');
  });

  it('sends the city inside the query text', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meta: { code: 200 }, result: { items: [] } }),
    });
    const service = new TwogisSuggestService(fetchImpl as unknown as typeof fetch);

    await service.suggestAddress({ q: 'Советский проспект, 54', city: 'Кемерово' });

    const calledUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(calledUrl.searchParams.get('q')).toBe('Кемерово, Советский проспект, 54');
  });

  it('returns an empty list for a short query without calling 2GIS', async () => {
    const fetchImpl = jest.fn();
    const service = new TwogisSuggestService(fetchImpl as unknown as typeof fetch);

    await expect(service.suggestAddress({ q: 'Л' })).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns an empty list when 2GIS answers with an error meta code', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meta: { code: 403 } }),
    });
    const service = new TwogisSuggestService(fetchImpl as unknown as typeof fetch);

    await expect(service.suggestAddress({ q: 'Ленина 24' })).resolves.toEqual([]);
  });

  it('returns an empty list when TWOGIS_API_KEY is missing and does not call 2GIS', async () => {
    delete process.env.TWOGIS_API_KEY;
    const fetchImpl = jest.fn();
    const service = new TwogisSuggestService(fetchImpl as unknown as typeof fetch);

    await expect(service.suggestAddress({ q: 'Ленина 24' })).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
