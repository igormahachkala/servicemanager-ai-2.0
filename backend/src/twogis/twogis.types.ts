export const TWOGIS_REQUEST_TIMEOUT_MS = 8_000;

export const TWOGIS_GEOCODE_URL = 'https://catalog.api.2gis.com/3.0/items/geocode';
export const TWOGIS_SUGGEST_URL = 'https://catalog.api.2gis.com/3.0/suggests';
export const TWOGIS_ROUTING_URL = 'https://routing.api.2gis.com/routing/7.0.0/global';

export const TWOGIS_PRECISIONS = ['exact', 'number', 'near', 'street', 'other'] as const;

export type TwogisPrecision = (typeof TWOGIS_PRECISIONS)[number];

export type TwogisGeocodeHit = {
  lat: number;
  lon: number;
  precision: TwogisPrecision | null;
  fullName: string;
  addressName?: string;
};

export type TwogisSuggestHit = {
  text: string;
  fullName: string;
};

export type TwogisRouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
};

export type TwogisLatLon = {
  lat: number;
  lon: number;
};

export type TwogisGeocodeInput = {
  city?: string | null;
  address?: string | null;
};

export type TwogisSuggestInput = {
  q: string;
  city?: string | null;
};

export function readTwogisApiKey(): string | null {
  const raw = process.env.TWOGIS_API_KEY;
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  return key.length > 0 ? key : null;
}

export function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readTwogisPrecision(value: unknown): TwogisPrecision | null {
  return typeof value === 'string' && TWOGIS_PRECISIONS.includes(value as TwogisPrecision)
    ? (value as TwogisPrecision)
    : null;
}

/**
 * GET/POST JSON helper. Returns null on network errors, timeouts, non-OK HTTP,
 * and invalid JSON. The request URL may contain the API key; callers must never log it.
 */
export async function twogisFetchJson(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<unknown | null> {
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(TWOGIS_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
