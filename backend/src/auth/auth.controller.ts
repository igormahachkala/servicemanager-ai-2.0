import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'

import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt.guard'
import { ImpersonateDto } from './dto/impersonate.dto'
import { LoginDto } from './dto/login.dto'
import { LoginRateLimiterService } from './login-rate-limiter.service'
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookieOptions,
  normalizeUserAgent,
  readCookieValue,
  refreshCookieOptions,
} from './auth-token-policy'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly loginRateLimiter: LoginRateLimiterService,
  ) {}

  @Post('register')
  register(
    @Body()
    dto: {
      companyName?: string
      email?: string
      password?: string
    },
  ) {
    return this.auth.register(dto)
  }

  @Post('login')
  async login(@Req() req: any, @Res({ passthrough: true }) res: Response, @Body() dto: LoginDto) {
    this.loginRateLimiter.consume(dto.email, req)
    const result = await this.auth.login(dto, this.refreshContext(req))
    this.setRefreshCookie(res, result.refreshToken)
    return result.payload
  }

  @Post('refresh')
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    this.loginRateLimiter.consume('refresh-session', req)
    const result = await this.auth.refresh(this.readRefreshToken(req), this.refreshContext(req))
    this.setRefreshCookie(res, result.refreshToken)
    return result.payload
  }

  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.logout(this.readRefreshToken(req))
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions())
    return result
  }

  @Post('impersonate')
  @UseGuards(JwtAuthGuard)
  impersonate(@Req() req: any, @Body() dto: ImpersonateDto) {
    return this.auth.impersonate(req.user, dto.companyId)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.auth.me(req.user.id, req.user.companyId)
  }

  private refreshContext(req: any) {
    return {
      userAgent: normalizeUserAgent(req?.headers?.['user-agent']),
    }
  }

  private readRefreshToken(req: any) {
    return readCookieValue(req?.headers?.cookie, REFRESH_COOKIE_NAME)
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions())
  }
}
