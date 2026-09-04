import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { createHash } from 'node:crypto'

import { resolveRequestClientIp } from '../http/client-ip'

type LoginRateLimitEntry = {
  attempts: number
  resetAt: number
}

@Injectable()
export class LoginRateLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(LoginRateLimiterService.name)
  private readonly attempts = new Map<string, LoginRateLimitEntry>()
  private readonly maxAttempts = this.envNumber('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 5)
  private readonly windowMs = this.envNumber('LOGIN_RATE_LIMIT_WINDOW_MS', 60_000)
  private readonly cleanupTimer: NodeJS.Timeout

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), this.windowMs)
    this.cleanupTimer.unref?.()
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer)
  }

  consume(email: string, req: any) {
    const now = Date.now()
    const ip = resolveRequestClientIp(req)
    this.logger.log(`login rate-limit ip=${ip}`)
    const key = this.keyFor(email, ip)
    const current = this.attempts.get(key)
    const entry =
      !current || current.resetAt <= now
        ? { attempts: 0, resetAt: now + this.windowMs }
        : current

    entry.attempts += 1
    this.attempts.set(key, entry)

    if (entry.attempts > this.maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Too many login attempts. Please wait before trying again.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  private keyFor(email: string, ip: string) {
    const normalizedEmail = (email || '').trim().toLowerCase() || 'unknown-email'
    const normalizedIp = (ip || '').trim() || 'unknown-ip'
    return createHash('sha256').update(`${normalizedIp}\n${normalizedEmail}`).digest('hex')
  }

  private cleanupExpired() {
    const now = Date.now()
    for (const [key, entry] of this.attempts.entries()) {
      if (entry.resetAt <= now) {
        this.attempts.delete(key)
      }
    }
  }

  private envNumber(name: string, fallback: number) {
    const value = Number(process.env[name])
    return Number.isFinite(value) && value > 0 ? value : fallback
  }
}
