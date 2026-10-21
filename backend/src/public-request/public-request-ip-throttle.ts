import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common'

import { resolveRequestClientIp } from '../http/client-ip'

type Bucket = { count: number; resetAt: number }

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 20

@Injectable()
export class PublicRequestIpThrottleGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>()

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest()
    const ip = resolveRequestClientIp(req)
    const now = Date.now()
    const current = this.buckets.get(ip)
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current
    bucket.count += 1
    this.buckets.set(ip, bucket)
    if (bucket.count > MAX_REQUESTS) {
      throw new HttpException('Too many requests from this address', HttpStatus.TOO_MANY_REQUESTS)
    }
    return true
  }
}
