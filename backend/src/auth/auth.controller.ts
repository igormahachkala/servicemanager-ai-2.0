import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'

import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt.guard'
import { ImpersonateDto } from './dto/impersonate.dto'
import { LoginDto } from './dto/login.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register() {
    return this.auth.register()
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
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
