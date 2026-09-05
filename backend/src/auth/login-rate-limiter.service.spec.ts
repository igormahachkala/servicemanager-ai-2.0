import { HttpException, HttpStatus } from '@nestjs/common'

import { LoginRateLimiterService } from './login-rate-limiter.service'

describe('LoginRateLimiterService', () => {
  let svc: LoginRateLimiterService

  beforeEach(() => {
    process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '5'
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000'
    svc = new LoginRateLimiterService()
  })

  afterEach(() => {
    svc.onModuleDestroy()
  })

  function req(overrides: {
    headers?: Record<string, unknown>
    ip?: string
    socket?: { remoteAddress?: string }
  } = {}) {
    return {
      headers: overrides.headers ?? {},
      ip: overrides.ip ?? '10.0.0.8',
      socket: overrides.socket ?? { remoteAddress: '172.18.0.1' },
    }
  }

  it('counts spoofed X-Forwarded-For values as the same client when req.ip is shared', () => {
    const email = 'a7-spoof@example.com'
    for (let i = 0; i < 5; i += 1) {
      svc.consume(email, req({ headers: { 'x-forwarded-for': '1.2.3.4' } }))
    }

    expect(() =>
      svc.consume(email, req({ headers: { 'x-forwarded-for': '9.9.9.9' } })),
    ).toThrow(
      expect.objectContaining({
        status: HttpStatus.TOO_MANY_REQUESTS,
      }),
    )
  })

  it('isolates buckets by X-Qrator-IP-Source even when req.ip matches', () => {
    const email = 'a7-qrator@example.com'
    for (let i = 0; i < 5; i += 1) {
      svc.consume(
        email,
        req({
          headers: { 'x-qrator-ip-source': '203.0.113.10' },
          ip: '10.0.0.8',
        }),
      )
    }

    expect(() =>
      svc.consume(
        email,
        req({
          headers: { 'x-qrator-ip-source': '203.0.113.10' },
          ip: '10.0.0.8',
        }),
      ),
    ).toThrow(HttpException)

    expect(() =>
      svc.consume(
        email,
        req({
          headers: { 'x-qrator-ip-source': '198.51.100.20' },
          ip: '10.0.0.8',
        }),
      ),
    ).not.toThrow()
  })
})
