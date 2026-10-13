import { Injectable, Optional } from '@nestjs/common';

import {
  asRecord,
  readFiniteNumber,
  readTwogisApiKey,
  twogisFetchJson,
  TWOGIS_ROUTING_URL,
  type TwogisLatLon,
  type TwogisRouteSummary,
} from './twogis.types';

@Injectable()
export class TwogisRoutingService {
  private readonly fetchImpl: typeof fetch;

  constructor(@Optional() fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async routeSummary(from: TwogisLatLon, to: TwogisLatLon): Promise<TwogisRouteSummary | null> {
    if (!isFinitePoint(from) || !isFinitePoint(to)) return null;

    const key = readTwogisApiKey();
    if (!key) return null;

    const url = new URL(TWOGIS_ROUTING_URL);
    url.searchParams.set('key', key);

    const body = await twogisFetchJson(this.fetchImpl, url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        points: [
          { type: 'stop', lon: from.lon, lat: from.lat },
          { type: 'stop', lon: to.lon, lat: to.lat },
        ],
        transport: 'driving',
        route_mode: 'fastest',
        traffic_mode: 'jam',
        output: 'summary',
        locale: 'ru',
      }),
    });

    return parseRouteSummary(body);
  }
}

function isFinitePoint(point: TwogisLatLon): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon);
}

function parseRouteSummary(body: unknown): TwogisRouteSummary | null {
  const root = asRecord(body);
  if (!root) return null;

  const result = root.result;
  const first = Array.isArray(result) ? asRecord(result[0]) : asRecord(result);
  if (!first) return null;

  const distanceMeters = readFiniteNumber(first.total_distance);
  const durationSeconds = readFiniteNumber(first.total_duration);
  if (distanceMeters === null || durationSeconds === null) return null;

  return { distanceMeters, durationSeconds };
}
