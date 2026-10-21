import { HttpStatus } from '@nestjs/common'

import { PublicRequestIpThrottleGuard } from './public-request-ip-throttle'

function contextFor(ip: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, headers: {}, socket: { remoteAddress: '127.0.0.1' } }),
    }),
  } as any
}

describe('PublicRequestIpThrottleGuard', () => {
  it('rejects the 21st request from the same address', () => {
    const guard = new PublicRequestIpThrottleGuard()
    const ctx = contextFor('203.0.113.8')
    for (let i = 0; i < 20; i += 1) {
      expect(guard.canActivate(ctx)).toBe(true)
    }
    expect(() => guard.canActivate(ctx)).toThrow(
      expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS }),
    )
  })
})
