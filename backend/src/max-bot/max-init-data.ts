import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * SMA-MAX-SECURE-USER-BINDING-054.
 *
 * Server-side verification of MAX Mini App `initData`.
 *
 * This is the ONLY thing in the codebase permitted to turn "a MAX client said so" into
 * "MAX cryptographically asserts this user id". Everything else — the bot, the menu, the
 * binding ceremony — depends on this returning `valid: true`.
 *
 * The algorithm is taken verbatim from the official MAX documentation
 * (dev.max.ru/docs/webapps/validation), not inferred from Telegram:
 *
 *   1. take the WebAppData string (`window.WebApp.initData`, or the URL fragment after `#`)
 *   2. parse it into key=value pairs
 *   3. `hash` must be present exactly once; remove it and keep the original value
 *   4. URL-decode every value
 *   5. sort the pairs by key, alphabetically a -> z
 *   6. build `launch_params` = key1=value1\nkey2=value2
 *   7. secret_key = HMAC_SHA256(key: "WebAppData", message: BOT_TOKEN)
 *   8. signature  = HMAC_SHA256(key: secret_key,   message: launch_params), hex-encoded
 *   9. data is authentic iff signature === hash
 *
 * MAX happens to document the same construction Telegram uses. That is a fact about MAX's
 * spec, checked against MAX's own page — not an assumption of Telegram compatibility. If
 * MAX ever diverges, this file is the single place that changes.
 *
 * Two properties MAX does NOT give us, which we add ourselves and label as our policy:
 *   * a freshness window over `auth_date` (MAX defines the field but no expiry);
 *   * single-use consumption (MAX documents no replay protection at all).
 * Freshness is enforced here; single-use lives in the binding service, which owns storage.
 */

/** Our policy, not MAX's: how old an `auth_date` may be and still be accepted. */
export const MAX_INIT_DATA_MAX_AGE_SECONDS = 300;

/** Our policy: reject timestamps implausibly far in the future (clock skew tolerance). */
export const MAX_INIT_DATA_FUTURE_SKEW_SECONDS = 60;

export type MaxInitDataRejectReason =
  | 'empty'
  | 'malformed'
  | 'hash_missing'
  | 'hash_duplicated'
  | 'signature_mismatch'
  | 'auth_date_missing'
  | 'auth_date_malformed'
  | 'expired'
  | 'future_dated'
  | 'max_user_id_missing'
  | 'bot_token_missing';

export type MaxInitDataUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
};

export type MaxInitDataChat = {
  id?: string;
  type?: string;
};

export type VerifiedMaxInitData = {
  /** Hex `hash` from the payload. An HMAC output, not a secret, but still never logged. */
  hash: string;
  /** MAX user id, as a string. The only identity claim we accept from a Mini App. */
  maxUserId: string;
  authDate: Date;
  user: MaxInitDataUser;
  chat?: MaxInitDataChat;
  startParam?: string;
  queryId?: string;
};

export type MaxInitDataVerification =
  | { valid: true; data: VerifiedMaxInitData }
  | { valid: false; reason: MaxInitDataRejectReason };

export type VerifyMaxInitDataOptions = {
  /** Defaults to now. Injected by tests so freshness cases are deterministic. */
  now?: Date;
  maxAgeSeconds?: number;
  futureSkewSeconds?: number;
};

/**
 * Verify a MAX `initData` payload against the bot token.
 *
 * Returns a reason rather than throwing, so callers can map to safe UX without ever
 * surfacing the payload. No branch here logs, echoes or returns the raw input.
 */
export function verifyMaxInitData(
  initData: string | null | undefined,
  botToken: string | null | undefined,
  options: VerifyMaxInitDataOptions = {},
): MaxInitDataVerification {
  const raw = (initData ?? '').trim();
  if (!raw) return { valid: false, reason: 'empty' };

  const token = (botToken ?? '').trim();
  if (!token) return { valid: false, reason: 'bot_token_missing' };

  // Step 1-2. Accept either the bare WebAppData string or a full URL carrying it in the
  // fragment, because the documented extraction path is "данные после символа #".
  const payload = extractPayload(raw);
  if (!payload) return { valid: false, reason: 'malformed' };

  const pairs = parsePairs(payload);
  if (!pairs) return { valid: false, reason: 'malformed' };

  // Step 3. `hash` exactly once. Two `hash` keys would make "which one did we check?"
  // ambiguous, and an attacker picks the ambiguity — so duplicates are rejected outright
  // rather than resolved by first-wins or last-wins.
  const hashes = pairs.filter((pair) => pair.key === 'hash');
  if (hashes.length === 0) return { valid: false, reason: 'hash_missing' };
  if (hashes.length > 1) return { valid: false, reason: 'hash_duplicated' };

  const providedHash = hashes[0].value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(providedHash)) return { valid: false, reason: 'malformed' };

  // Steps 4-6. Values are already URL-decoded by parsePairs; sort by key and join.
  const launchParams = pairs
    .filter((pair) => pair.key !== 'hash')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((pair) => `${pair.key}=${pair.value}`)
    .join('\n');

  // Steps 7-8.
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  const signature = createHmac('sha256', secretKey).update(launchParams).digest('hex');

  // Step 9. Constant-time: a byte-wise early return would leak the expected signature
  // one character at a time to anyone able to time our responses.
  if (!constantTimeHexEqual(signature, providedHash)) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  // --- Beyond the MAX spec: our own freshness policy. ---
  const authDateRaw = pairs.find((pair) => pair.key === 'auth_date')?.value;
  if (!authDateRaw) return { valid: false, reason: 'auth_date_missing' };

  const authDateSeconds = Number(authDateRaw);
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0 || !Number.isInteger(authDateSeconds)) {
    return { valid: false, reason: 'auth_date_malformed' };
  }

  const now = options.now ?? new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const maxAge = options.maxAgeSeconds ?? MAX_INIT_DATA_MAX_AGE_SECONDS;
  const futureSkew = options.futureSkewSeconds ?? MAX_INIT_DATA_FUTURE_SKEW_SECONDS;

  if (authDateSeconds > nowSeconds + futureSkew) return { valid: false, reason: 'future_dated' };
  if (nowSeconds - authDateSeconds > maxAge) return { valid: false, reason: 'expired' };

  // The user object is the identity claim. A signed payload without one proves that MAX
  // signed something, not that a particular person launched the app — so it is rejected.
  const user = parseUser(pairs.find((pair) => pair.key === 'user')?.value);
  if (!user) return { valid: false, reason: 'max_user_id_missing' };

  return {
    valid: true,
    data: {
      hash: providedHash,
      maxUserId: user.id,
      authDate: new Date(authDateSeconds * 1000),
      user,
      chat: parseChat(pairs.find((pair) => pair.key === 'chat')?.value),
      startParam: pairs.find((pair) => pair.key === 'start_param')?.value || undefined,
      queryId: pairs.find((pair) => pair.key === 'query_id')?.value || undefined,
    },
  };
}

/** Accepts a bare WebAppData string or any URL whose fragment carries it. */
function extractPayload(raw: string): string | null {
  const hashIndex = raw.indexOf('#');
  const candidate = hashIndex >= 0 ? raw.slice(hashIndex + 1) : raw;
  const trimmed = candidate.trim();
  return trimmed || null;
}

type Pair = { key: string; value: string };

/**
 * Parses `a=1&b=2` into decoded pairs. Deliberately hand-rolled rather than using
 * URLSearchParams: that class silently collapses duplicate keys, and duplicate-key
 * detection is exactly what step 3 depends on.
 */
function parsePairs(payload: string): Pair[] | null {
  const parts = payload.split('&').filter((part) => part.length > 0);
  if (parts.length === 0) return null;

  const pairs: Pair[] = [];
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator <= 0) return null;
    const key = part.slice(0, separator);
    const rawValue = part.slice(separator + 1);
    let value: string;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      return null;
    }
    pairs.push({ key, value });
  }
  return pairs;
}

function parseUser(rawUser?: string): MaxInitDataUser | null {
  if (!rawUser) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawUser);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const id = normalizeId(record.id);
  if (!id) return null;

  return {
    id,
    firstName: stringOrUndefined(record.first_name),
    lastName: stringOrUndefined(record.last_name),
    username: stringOrUndefined(record.username),
  };
}

function parseChat(rawChat?: string): MaxInitDataChat | undefined {
  if (!rawChat) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawChat);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;

  const record = parsed as Record<string, unknown>;
  return {
    id: normalizeId(record.id) ?? undefined,
    type: stringOrUndefined(record.type),
  };
}

/** MAX sends numeric ids; we store strings so the id never suffers float precision loss. */
function normalizeId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  if (bufferA.length !== bufferB.length || bufferA.length === 0) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Stable digest of the payload `hash`, used as the replay-guard key.
 *
 * The signature itself is never persisted: storing a one-way digest keeps the replay
 * guard exact while leaving nothing at rest that could be replayed if the table leaked.
 */
export function maxInitDataReplayDigest(hash: string): string {
  return createHmac('sha256', 'MaxInitDataReplayGuard').update(hash.toLowerCase()).digest('hex');
}
