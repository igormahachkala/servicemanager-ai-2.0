import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  createCorsOriginDelegate,
  normalizeCorsOrigin,
  parseCorsAllowedOrigins,
} from './cors';

describe('CORS allowlist', () => {
  const productionOrigins =
    'https://servicemanagerai.ru,https://max.servicemanagerai.ru';

  it('normalizes exact http and https origins only', () => {
    expect(normalizeCorsOrigin(' https://max.servicemanagerai.ru/ ')).toBe(
      'https://max.servicemanagerai.ru',
    );
    expect(normalizeCorsOrigin('https://max.servicemanagerai.ru/path')).toBeNull();
    expect(normalizeCorsOrigin('*')).toBeNull();
    expect(normalizeCorsOrigin('javascript:alert(1)')).toBeNull();
  });

  it('allows the production web app and MAX Mini App origins', () => {
    const allowedOrigins = parseCorsAllowedOrigins(productionOrigins);
    const origin = createCorsOriginDelegate(allowedOrigins);
    const callback = jest.fn();

    origin('https://servicemanagerai.ru', callback);
    origin('https://max.servicemanagerai.ru', callback);

    expect(callback).toHaveBeenNthCalledWith(1, null, true);
    expect(callback).toHaveBeenNthCalledWith(2, null, true);
  });

  it('does not allow unknown origins or wildcard configuration', () => {
    const allowedOrigins = parseCorsAllowedOrigins(`${productionOrigins},*`);
    const origin = createCorsOriginDelegate(allowedOrigins);
    const callback = jest.fn();

    origin('https://evil.example', callback);
    origin('https://servicemanagerai.ru.evil.example', callback);

    expect(callback).toHaveBeenNthCalledWith(1, null, false);
    expect(callback).toHaveBeenNthCalledWith(2, null, false);
    expect(allowedOrigins.has('*')).toBe(false);
  });

  it('keeps server-side requests without an Origin header working', () => {
    const origin = createCorsOriginDelegate(parseCorsAllowedOrigins(productionOrigins));
    const callback = jest.fn();

    origin(undefined, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('allows the Idempotency-Key header through the preflight', () => {
    /*
     * SMA-MOBILE-OFFLINE-INTEGRATION-113D.
     *
     * 113B accepts this header on every replayable write, but a browser can
     * only send a header named in allowedHeaders: anything else is rejected
     * by the preflight, and fetch fails with a bare "Failed to fetch" that
     * looks exactly like no connectivity. The offline queue then retried
     * forever and the technician's work never left the device.
     *
     * Found by live Stage acceptance, not by tests — which is why the check
     * is pinned to the source here.
     */
    const main = readFileSync(resolve(__dirname, '../main.ts'), 'utf8');
    const allowed = /allowedHeaders:\s*\[([^\]]*)\]/.exec(main)?.[1] ?? '';

    expect(allowed).toContain("'Idempotency-Key'");
    expect(allowed).toContain("'Authorization'");
    expect(allowed).toContain("'Content-Type'");
  });

  it('documents nginx as not owning API CORS headers', () => {
    const config = readFileSync(
      resolve(__dirname, '../../../docs/nginx-api.servicemanagerai.ru.conf'),
      'utf8',
    );

    expect(config).not.toContain('sma_api_cors_origin');
    expect(config).not.toMatch(/Access-Control-Allow-Credentials/i);
    expect(config).not.toMatch(/default\s+"\*"/);
    expect(config).not.toMatch(/Access-Control-Allow-Origin\s+"\*"/);
  });
});
