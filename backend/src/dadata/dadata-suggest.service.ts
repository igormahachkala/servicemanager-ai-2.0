import { Injectable, Optional } from '@nestjs/common'

import {
  asRecord,
  dadataFetchJson,
  DADATA_SUGGEST_URL,
  readDadataApiKey,
  readFiniteNumber,
  readNonEmptyString,
  readQcGeo,
  trimToNull,
  type DadataSuggestHit,
  type DadataSuggestInput,
} from './dadata.types'

const SUGGEST_CACHE_LIMIT = 100

@Injectable()
export class DadataSuggestService {
  private readonly fetchImpl: typeof fetch
  private readonly cache = new Map<string, DadataSuggestHit[]>()

  constructor(@Optional() fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch
  }

  async suggestAddress(input: DadataSuggestInput): Promise<DadataSuggestHit[]> {
    const q = trimToNull(input.q)
    if (!q || q.length < 2) return []

    const city = trimToNull(input.city)
    const cacheKey = `${city ?? ''}|${q}`
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const apiKey = readDadataApiKey()
    if (!apiKey) return []

    const body: Record<string, unknown> = {
      query: q,
      count: 10,
    }
    if (city) {
      body.locations = [{ city }]
      body.locations_boost = [{ city }]
    }

    const response = await dadataFetchJson(this.fetchImpl, DADATA_SUGGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const hits = parseSuggestHits(response)
    rememberCache(this.cache, cacheKey, hits)
    return hits
  }
}

function rememberCache(
  cache: Map<string, DadataSuggestHit[]>,
  key: string,
  hits: DadataSuggestHit[],
) {
  if (cache.size >= SUGGEST_CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, hits)
}

export function parseSuggestHits(body: unknown): DadataSuggestHit[] {
  const root = asRecord(body)
  if (!root) return []

  const suggestions = root.suggestions
  if (!Array.isArray(suggestions)) return []

  const hits: DadataSuggestHit[] = []
  for (const item of suggestions) {
    const record = asRecord(item)
    if (!record) continue
    const data = asRecord(record.data)
    const fullName =
      readNonEmptyString(record.unrestricted_value) || readNonEmptyString(record.value)
    if (!fullName) continue

    const text = buildAddressText(data, record) || fullName
    const city = readCity(data)
    const latitude = readFiniteNumber(data?.geo_lat)
    const longitude = readFiniteNumber(data?.geo_lon)
    const qcGeo = readQcGeo(data?.qc_geo)

    hits.push({
      text,
      fullName,
      city,
      latitude,
      longitude,
      qcGeo,
    })
  }
  return hits
}

function buildAddressText(
  data: Record<string, unknown> | null,
  record: Record<string, unknown>,
): string | null {
  if (!data) return readNonEmptyString(record.value)

  const street = readNonEmptyString(data.street_with_type)
  const house = readNonEmptyString(data.house)
  if (street && house) return `${street}, ${house}`
  if (street) return street

  const value = readNonEmptyString(record.value)
  if (value) return value
  return null
}

function readCity(data: Record<string, unknown> | null): string | null {
  if (!data) return null
  const city =
    readNonEmptyString(data.city) ||
    readNonEmptyString(data.settlement) ||
    stripCityPrefix(readNonEmptyString(data.city_with_type)) ||
    stripCityPrefix(readNonEmptyString(data.settlement_with_type))
  return city
}

function stripCityPrefix(value: string | null): string | null {
  if (!value) return null
  return value.replace(/^г\.?\s+/i, '').trim() || null
}
