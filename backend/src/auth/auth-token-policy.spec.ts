import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookieOptions,
  getAccessTokenTtl,
  getRefreshSessionTtlMs,
  readCookieValue,
  refreshCookieOptions,
} from './auth-token-policy'

describe('auth token policy', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.AUTH_ACCESS_TOKEN_TTL
    delete process.env.JWT_ACCESS_TOKEN_TTL
    delete process.env.AUTH_REFRESH_SESSION_TTL_MS
    delete process.env.AUTH_REFRESH_SESSION_TTL_DAYS
    delete process.env.AUTH_REFRESH_COOKIE_SECURE
    delete process.env.AUTH_REFRESH_COOKIE_SAMESITE
    delete process.env.NODE_ENV
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('uses short-lived access tokens by default and configurable refresh TTL', () => {
    expect(getAccessTokenTtl()).toBe('15m')
    expect(getRefreshSessionTtlMs()).toBe(30 * 24 * 60 * 60 * 1000)

    process.env.AUTH_ACCESS_TOKEN_TTL = '10m'
    process.env.AUTH_REFRESH_SESSION_TTL_DAYS = '7'

    expect(getAccessTokenTtl()).toBe('10m')
    expect(getRefreshSessionTtlMs()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('sets refresh cookie as HttpOnly and Secure in production', () => {
    process.env.NODE_ENV = 'production'
    const options = refreshCookieOptions()

    expect(REFRESH_COOKIE_NAME).toBe('sma_refresh_token')
    expect(options.httpOnly).toBe(true)
    expect(options.secure).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/auth')
  })

  it('clears refresh cookie with the same security attributes', () => {
    process.env.AUTH_REFRESH_COOKIE_SECURE = 'true'
    const options = clearRefreshCookieOptions()

    expect(options.httpOnly).toBe(true)
    expect(options.secure).toBe(true)
    expect(options.path).toBe('/auth')
    expect(options.maxAge).toBe(0)
  })

  it('reads a single cookie value without exposing other cookies', () => {
    expect(readCookieValue('foo=bar; sma_refresh_token=secret%20value; other=1', REFRESH_COOKIE_NAME)).toBe('secret value')
    expect(readCookieValue('foo=bar', REFRESH_COOKIE_NAME)).toBe('')
  })
})
