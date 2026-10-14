import { TwogisRoutingService } from './twogis-routing.service';

const FROM = { lat: 55.75, lon: 37.62 };
const TO = { lat: 55.770784, lon: 37.609256 };

describe('TwogisRoutingService', () => {
  beforeEach(() => {
    process.env.TWOGIS_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.TWOGIS_API_KEY;
  });

  it('parses distance and duration from a routing summary', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: [{ total_distance: 5570, total_duration: 1073 }],
      }),
    });
    const service = new TwogisRoutingService(fetchImpl as unknown as typeof fetch);

    await expect(service.routeSummary(FROM, TO)).resolves.toEqual({
      distanceMeters: 5570,
      durationSeconds: 1073,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://routing.api.2gis.com/routing/7.0.0/global',
    );
    expect(calledUrl.searchParams.get('key')).toBe('test-key');

    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      points: [
        { type: 'stop', lon: FROM.lon, lat: FROM.lat },
        { type: 'stop', lon: TO.lon, lat: TO.lat },
      ],
      transport: 'driving',
      route_mode: 'fastest',
      traffic_mode: 'jam',
      output: 'summary',
      locale: 'ru',
    });
  });

  it('returns null when the routing request fails', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('network down'));
    const service = new TwogisRoutingService(fetchImpl as unknown as typeof fetch);

    await expect(service.routeSummary(FROM, TO)).resolves.toBeNull();
  });

  it('returns null on HTTP 4xx/5xx without throwing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'upstream' }),
    });
    const service = new TwogisRoutingService(fetchImpl as unknown as typeof fetch);

    await expect(service.routeSummary(FROM, TO)).resolves.toBeNull();
  });

  it('returns null when total_distance or total_duration is missing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [{ total_distance: 100 }] }),
    });
    const service = new TwogisRoutingService(fetchImpl as unknown as typeof fetch);

    await expect(service.routeSummary(FROM, TO)).resolves.toBeNull();
  });

  it('returns null when TWOGIS_API_KEY is missing and does not call 2GIS', async () => {
    delete process.env.TWOGIS_API_KEY;
    const fetchImpl = jest.fn();
    const service = new TwogisRoutingService(fetchImpl as unknown as typeof fetch);

    await expect(service.routeSummary(FROM, TO)).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
