import { Injectable, Optional } from '@nestjs/common'

import {
  asRecord,
  dadataFetchJson,
  DADATA_CLEAN_URL,
  readDadataApiKey,
  readDadataSecretKey,
  readFiniteNumber,
  readNonEmptyString,
  readQcGeo,
  trimToNull,
  type DadataGeocodeHit,
  type DadataGeocodeInput,
} from './dadata.types'

@Injectable()
export class DadataGeocoderService {
  private readonly fetchImpl: typeof fetch

  constructor(@Optional() fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch
  }

  async geocodeAddress(input: DadataGeocodeInput): Promise<DadataGeocodeHit | null> {
    const address = trimToNull(input.address)
    if (!address) return null

    const apiKey = readDadataApiKey()
    const secretKey = readDadataSecretKey()
    if (!apiKey || !secretKey) return null

    const city = trimToNull(input.city)
    const query = city ? `${city}, ${address}` : address

    const body = await dadataFetchJson(this.fetchImpl, DADATA_CLEAN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${apiKey}`,
        'X-Secret': secretKey,
      },
      body: JSON.stringify([query]),
    })

    return parseCleanHit(body)
  }
}

export function parseCleanHit(body: unknown): DadataGeocodeHit | null {
  if (!Array.isArray(body) || body.length === 0) return null

  const first = asRecord(body[0])
  if (!first) return null

  const lat = readFiniteNumber(first.geo_lat)
  const lon = readFiniteNumber(first.geo_lon)
  if (lat === null || lon === null) return null

  const fullName =
    readNonEmptyString(first.result) ||
    readNonEmptyString(first.source) ||
    ''

  return {
    lat,
    lon,
    qcGeo: readQcGeo(first.qc_geo),
    fullName,
  }
}
