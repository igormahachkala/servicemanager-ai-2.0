export type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

export function normalizeCorsOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseCorsAllowedOrigins(raw: string): Set<string> {
  const origins = new Set<string>();
  for (const part of raw.split(',')) {
    const origin = normalizeCorsOrigin(part);
    if (origin) origins.add(origin);
  }
  return origins;
}

export function createCorsOriginDelegate(allowedOrigins: ReadonlySet<string>) {
  return (origin: string | undefined, callback: CorsOriginCallback) => {
    // No Origin header = curl / server-side request: allow.
    if (!origin) return callback(null, true);

    const normalized = normalizeCorsOrigin(origin);
    if (normalized && allowedOrigins.has(normalized)) {
      return callback(null, true);
    }

    return callback(null, false);
  };
}
