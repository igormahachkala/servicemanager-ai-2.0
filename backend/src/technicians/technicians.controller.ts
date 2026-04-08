import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'

import { TechniciansService } from './technicians.service'
import { TechniciansWorkloadService } from './technicians.workload.service'
import { SetTechnicianSpecializationsDto } from './dto/set-technician-specializations.dto'
import { SetTechnicianBindingsDto } from './dto/set-technician-bindings.dto'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('technicians')
export class TechniciansController {
  constructor(
    private readonly svc: TechniciansService,
    private readonly workloadService: TechniciansWorkloadService,
  ) {}

  @Get('me')
  @Roles(UserRole.TECHNICIAN)
  me(@Req() req: any) {
    return this.svc.getMe(req.user.companyId, req.user.id)
  }

  @Get('me/bound-contexts')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  boundContexts(@Req() req: any) {
    return this.svc.getBoundContexts(req.user.companyId, req.user.id)
  }

  @Get('workload')
  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  workload(@Req() req: any) {
    return this.workloadService.getWorkload(req.user.companyId)
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  list(@Req() req: any) {
    return this.svc.list(req.user.companyId)
  }

  @Put(':id/specializations')
  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  setSpecializations(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetTechnicianSpecializationsDto,
  ) {
    return this.svc.setSpecializations(req.user.companyId, id, dto.specializationIds ?? [])
  }

  @Put(':id/bindings')
  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  setBindings(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetTechnicianBindingsDto,
  ) {
    return this.svc.setBindings(req.user.companyId, id, dto.bindings ?? [])
  }
}