import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'

import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt.guard'
import { ImpersonateDto } from './dto/impersonate.dto'
import { LoginDto } from './dto/login.dto'
import { LoginRateLimiterService } from './login-rate-limiter.service'

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
  login(@Req() req: any, @Body() dto: LoginDto) {
    this.loginRateLimiter.consume(dto.email, req)
    return this.auth.login(dto)
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
}
