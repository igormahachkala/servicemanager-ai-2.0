import { Injectable, Optional } from '@nestjs/common';

import {
  asRecord,
  readFiniteNumber,
  readNonEmptyString,
  readTwogisApiKey,
  trimToNull,
  twogisFetchJson,
  TWOGIS_SUGGEST_URL,
  type TwogisSuggestHit,
  type TwogisSuggestInput,
} from './twogis.types';

@Injectable()
export class TwogisSuggestService {
  private readonly fetchImpl: typeof fetch;

  constructor(@Optional() fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async suggestAddress(input: TwogisSuggestInput): Promise<TwogisSuggestHit[]> {
    const q = trimToNull(input.q);
    if (!q || q.length < 2) return [];

    const key = readTwogisApiKey();
    if (!key) return [];

    // `city` cannot be applied as a location filter without lon,lat. Do not invent coordinates.
    const url = new URL(TWOGIS_SUGGEST_URL);
    url.searchParams.set('q', q);
    url.searchParams.set('suggest_type', 'address');
    url.searchParams.set('locale', 'ru_RU');
    url.searchParams.set('key', key);

    const body = await twogisFetchJson(this.fetchImpl, url.toString(), { method: 'GET' });
    return parseSuggestHits(body);
  }
}

function parseSuggestHits(body: unknown): TwogisSuggestHit[] {
  const root = asRecord(body);
  if (!root) return [];

  const meta = asRecord(root.meta);
  if (readFiniteNumber(meta?.code) !== 200) return [];

  const result = asRecord(root.result);
  const items = result?.items;
  if (!Array.isArray(items)) return [];

  const hits: TwogisSuggestHit[] = [];
  for (const item of items) {
    const record = asRecord(item);
    if (!record) continue;
    const fullName =
      readNonEmptyString(record.full_name) ||
      readNonEmptyString(record.address_name) ||
      readNonEmptyString(record.name);
    const text =
      readNonEmptyString(record.address_name) ||
      readNonEmptyString(record.name) ||
      readNonEmptyString(asRecord(record.search_attributes)?.suggested_text) ||
      fullName;
    if (!text || !fullName) continue;
    hits.push({ text, fullName });
  }
  return hits;
}
