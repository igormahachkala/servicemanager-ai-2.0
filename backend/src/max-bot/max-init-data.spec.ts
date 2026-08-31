import { createHmac } from 'node:crypto';

import {
  MAX_INIT_DATA_MAX_AGE_SECONDS,
  maxInitDataReplayDigest,
  verifyMaxInitData,
} from './max-init-data';

/**
 * SMA-MAX-SECURE-USER-BINDING-054.
 *
 * These tests are the specification. Each one states an attack or a malformed input and
 * asserts we refuse it, because everything downstream — the binding, the bot, any future
 * button — trusts `valid: true` completely.
 *
 * The signing helper below reimplements the documented algorithm independently of the
 * production code path, so a change to either side breaks the tests rather than sliding
 * through unnoticed.
 */

const BOT_TOKEN = 'test-bot-token-054';

function sign(params: Record<string, string>, token = BOT_TOKEN): string {
  const launchParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  return createHmac('sha256', secretKey).update(launchParams).digest('hex');
}

function buildInitData(
  overrides: Partial<Record<string, string>> = {},
  options: { token?: string; omitHash?: boolean; duplicateHash?: boolean; badHash?: string } = {},
): string {
  const params: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'q-1',
    user: JSON.stringify({ id: 4242, first_name: 'Ada', last_name: 'L', username: 'ada' }),
    chat: JSON.stringify({ id: 77, type: 'DIALOG' }),
    ...overrides,
  };
  for (const key of Object.keys(params)) {
    if (params[key] === undefined) delete params[key];
  }

  const hash = options.badHash ?? sign(params, options.token ?? BOT_TOKEN);
  const encoded = Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`);
  if (!options.omitHash) encoded.push(`hash=${hash}`);
  if (options.duplicateHash) encoded.push(`hash=${hash}`);
  return encoded.join('&');
}

describe('verifyMaxInitData', () => {
  it('accepts a correctly signed payload and extracts the MAX identity', () => {
    const result = verifyMaxInitData(buildInitData(), BOT_TOKEN);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.maxUserId).toBe('4242');
    expect(result.data.user.username).toBe('ada');
    expect(result.data.chat?.type).toBe('DIALOG');
  });

  it('accepts the payload when it arrives as a URL fragment', () => {
    const initData = buildInitData();
    const result = verifyMaxInitData(`https://app.example/max#${initData}`, BOT_TOKEN);
    expect(result.valid).toBe(true);
  });

  it('carries start_param through for deep links', () => {
    const result = verifyMaxInitData(
      buildInitData({ start_param: 'ticket_05c09094-f730-4a56-967b-ed0a74a267c3' }),
      BOT_TOKEN,
    );
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.startParam).toBe('ticket_05c09094-f730-4a56-967b-ed0a74a267c3');
  });

  // --- tamper ---

  it('rejects a tampered user id even though every other field is authentic', () => {
    const authentic = buildInitData();
    const tampered = authentic.replace(
      encodeURIComponent(JSON.stringify({ id: 4242, first_name: 'Ada', last_name: 'L', username: 'ada' })),
      encodeURIComponent(JSON.stringify({ id: 9999, first_name: 'Ada', last_name: 'L', username: 'ada' })),
    );
    expect(tampered).not.toBe(authentic);
    const result = verifyMaxInitData(tampered, BOT_TOKEN);
    expect(result).toEqual({ valid: false, reason: 'signature_mismatch' });
  });

  it('rejects a payload signed with a different bot token', () => {
    const result = verifyMaxInitData(buildInitData({}, { token: 'someone-elses-token' }), BOT_TOKEN);
    expect(result).toEqual({ valid: false, reason: 'signature_mismatch' });
  });

  it('rejects an added field that was not part of the signature', () => {
    const result = verifyMaxInitData(`${buildInitData()}&injected=1`, BOT_TOKEN);
    expect(result).toEqual({ valid: false, reason: 'signature_mismatch' });
  });

  // --- structural ---

  it('rejects a missing hash', () => {
    expect(verifyMaxInitData(buildInitData({}, { omitHash: true }), BOT_TOKEN)).toEqual({
      valid: false,
      reason: 'hash_missing',
    });
  });

  it('rejects a duplicated hash rather than picking one', () => {
    expect(verifyMaxInitData(buildInitData({}, { duplicateHash: true }), BOT_TOKEN)).toEqual({
      valid: false,
      reason: 'hash_duplicated',
    });
  });

  it('rejects a hash that is not 64 hex characters', () => {
    expect(verifyMaxInitData(buildInitData({}, { badHash: 'deadbeef' }), BOT_TOKEN)).toEqual({
      valid: false,
      reason: 'malformed',
    });
  });

  it('rejects empty input and a missing bot token', () => {
    expect(verifyMaxInitData('', BOT_TOKEN)).toEqual({ valid: false, reason: 'empty' });
    expect(verifyMaxInitData(buildInitData(), '')).toEqual({ valid: false, reason: 'bot_token_missing' });
  });

  it('rejects malformed pair syntax', () => {
    expect(verifyMaxInitData('not-a-pair', BOT_TOKEN)).toEqual({ valid: false, reason: 'malformed' });
  });

  // --- freshness (our policy; MAX documents no expiry) ---

  it('rejects a payload older than the freshness window', () => {
    const authDate = Math.floor(Date.now() / 1000) - (MAX_INIT_DATA_MAX_AGE_SECONDS + 60);
    const result = verifyMaxInitData(buildInitData({ auth_date: String(authDate) }), BOT_TOKEN);
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('accepts a payload inside the freshness window', () => {
    const authDate = Math.floor(Date.now() / 1000) - Math.floor(MAX_INIT_DATA_MAX_AGE_SECONDS / 2);
    expect(verifyMaxInitData(buildInitData({ auth_date: String(authDate) }), BOT_TOKEN).valid).toBe(true);
  });

  it('rejects a future-dated payload beyond clock skew', () => {
    const authDate = Math.floor(Date.now() / 1000) + 3600;
    expect(verifyMaxInitData(buildInitData({ auth_date: String(authDate) }), BOT_TOKEN)).toEqual({
      valid: false,
      reason: 'future_dated',
    });
  });

  it('rejects a missing or malformed auth_date', () => {
    expect(verifyMaxInitData(buildInitData({ auth_date: undefined as any }), BOT_TOKEN)).toEqual({
      valid: false,
      reason: 'auth_date_missing',
    });
    expect(verifyMaxInitData(buildInitData({ auth_date: 'yesterday' }), BOT_TOKEN)).toEqual({
      valid: false,
      reason: 'auth_date_malformed',
    });
  });

  // --- identity presence ---

  it('rejects a correctly signed payload that carries no user', () => {
    expect(verifyMaxInitData(buildInitData({ user: undefined as any }), BOT_TOKEN)).toEqual({
      valid: false,
      reason: 'max_user_id_missing',
    });
  });

  it('rejects a user object with no id', () => {
    expect(verifyMaxInitData(buildInitData({ user: JSON.stringify({ first_name: 'Ada' }) }), BOT_TOKEN)).toEqual(
      { valid: false, reason: 'max_user_id_missing' },
    );
  });

  // --- replay digest ---

  it('derives a stable digest that is not the signature itself', () => {
    const result = verifyMaxInitData(buildInitData(), BOT_TOKEN);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    const digest = maxInitDataReplayDigest(result.data.hash);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toBe(result.data.hash);
    expect(maxInitDataReplayDigest(result.data.hash)).toBe(digest);
  });
});
