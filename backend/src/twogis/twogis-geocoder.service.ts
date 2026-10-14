import { Injectable, Optional } from '@nestjs/common';

import {
  asRecord,
  readFiniteNumber,
  readNonEmptyString,
  readTwogisApiKey,
  readTwogisPrecision,
  trimToNull,
  twogisFetchJson,
  TWOGIS_GEOCODE_URL,
  type TwogisGeocodeHit,
  type TwogisGeocodeInput,
} from './twogis.types';

@Injectable()
export class TwogisGeocoderService {
  private readonly fetchImpl: typeof fetch;

  constructor(@Optional() fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async geocodeAddress(input: TwogisGeocodeInput): Promise<TwogisGeocodeHit | null> {
    const address = trimToNull(input.address);
    if (!address) return null;

    const key = readTwogisApiKey();
    if (!key) return null;

    const city = trimToNull(input.city);
    const q = city ? `${address}, ${city}` : address;

    const url = new URL(TWOGIS_GEOCODE_URL);
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'building');
    url.searchParams.set('locale', 'ru_RU');
    url.searchParams.set(
      'fields',
      'items.point,items.geometry.centroid,items.search_attributes.dgis_address_details',
    );
    url.searchParams.set('key', key);

    const body = await twogisFetchJson(this.fetchImpl, url.toString(), { method: 'GET' });
    return parseGeocodeHit(body);
  }
}

function parseGeocodeHit(body: unknown): TwogisGeocodeHit | null {
  const root = asRecord(body);
  if (!root) return null;

  const meta = asRecord(root.meta);
  if (readFiniteNumber(meta?.code) !== 200) return null;

  const result = asRecord(root.result);
  const items = result?.items;
  if (!Array.isArray(items) || items.length === 0) return null;

  const first = asRecord(items[0]);
  if (!first) return null;

  const point = asRecord(first.point);
  const lat = readFiniteNumber(point?.lat);
  const lon = readFiniteNumber(point?.lon);
  if (lat === null || lon === null) return null;

  const details = asRecord(asRecord(first.search_attributes)?.dgis_address_details);
  const fullName =
    readNonEmptyString(first.full_name) ||
    readNonEmptyString(first.address_name) ||
    readNonEmptyString(first.name) ||
    '';
  const addressName = readNonEmptyString(first.address_name) ?? undefined;

  const hit: TwogisGeocodeHit = {
    lat,
    lon,
    precision: readTwogisPrecision(details?.precision),
    fullName,
    matchCount: items.length,
  };
  if (addressName) hit.addressName = addressName;
  return hit;
}
