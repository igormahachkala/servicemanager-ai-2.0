import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'

import { UpdateCompanyDto } from './dto/update-company.dto'
import { CreateCompanyDto } from './dto/create-company.dto'
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto'
import { CompanyService } from './company.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CompanyController {
  constructor(private svc: CompanyService) {}

  @Roles(UserRole.PLATFORM_ADMIN)
  @Get('companies')
  listAll() {
    return this.svc.listAll()
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Post('companies')
  createPlatformCompany(@Body() dto: CreateCompanyDto) {
    return this.svc.createPlatformCompany(dto)
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Post('companies/:id/admins')
  createFirstAdmin(@Param('id') companyId: string, @Body() dto: CreateCompanyAdminDto) {
    return this.svc.createFirstAdmin(companyId, dto)
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Patch('companies/:id/public-request/token')
  regeneratePlatformPublicRequestToken(@Param('id') companyId: string) {
    return this.svc.regeneratePlatformPublicRequestToken(companyId)
  }

  @Roles(UserRole.ADMIN)
  @Get('company')
  get(@Req() req: any) {
    return this.svc.get(req.user.companyId)
  }

  @Roles(UserRole.ADMIN)
  @Patch('company')
  update(@Req() req: any, @Body() dto: UpdateCompanyDto) {
    return this.svc.update(req.user.companyId, dto)
  }

  @Roles(UserRole.ADMIN)
  @Patch('company/auto-assign')
  setAutoAssign(@Req() req: any, @Body() body: { enabled: boolean }) {
    return this.svc.setAutoAssign(req.user.companyId, !!body.enabled)
  }

  @Roles(UserRole.ADMIN)
  @Patch('company/public-request/token')
  regenerateOwnPublicRequestToken(@Req() req: any) {
    return this.svc.regeneratePublicRequestToken(req.user.companyId)
  }
}
