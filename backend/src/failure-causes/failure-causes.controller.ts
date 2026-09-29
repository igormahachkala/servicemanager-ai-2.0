import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { RolesGuard } from '../common/roles.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { Roles } from '../common/roles.decorator'
import { RequirePermission } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'
import { ManagementSurface } from '../common/management-surface-access'
import { CreateFailureCauseDto } from './dto/create-failure-cause.dto'
import { UpdateFailureCauseDto } from './dto/update-failure-cause.dto'
import { FailureCausesService } from './failure-causes.service'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('failure-causes')
export class FailureCausesController {
  constructor(private readonly svc: FailureCausesService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
  )
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  listOwn(@Req() req: any, @Query('active') active?: string) {
    return this.svc.listOwn(req.user.companyId, active)
  }

  @Post()
  @ManagementSurface()
  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.COMPANY_SETTINGS_EDIT)
  create(@Req() req: any, @Body() dto: CreateFailureCauseDto) {
    return this.svc.create(req.user.companyId, dto)
  }

  @Patch(':id')
  @ManagementSurface()
  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.COMPANY_SETTINGS_EDIT)
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateFailureCauseDto) {
    return this.svc.update(req.user.companyId, id, dto)
  }

  @Patch(':id/status')
  @ManagementSurface()
  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.COMPANY_SETTINGS_EDIT)
  setStatus(@Req() req: any, @Param('id') id: string, @Body() body: { active: boolean }) {
    return this.svc.setStatus(req.user.companyId, id, !!body.active)
  }
}
