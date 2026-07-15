import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'

import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'

import { LocationsService } from './locations.service'
import { CreateLocationDto } from './dto/create-location.dto'
import { UpdateLocationDto } from './dto/update-location.dto'
import { SetLocationStatusDto } from './dto/set-location-status.dto'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly svc: LocationsService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.PLATFORM_ADMIN,
  )
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  list(
    @Req() req: any,
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('isActive') isActive?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.svc.list(req.user.companyId, req.user.role as UserRole, req.user.id, {
      q,
      city,
      isActive,
      includeDeleted: includeDeleted === 'true',
    }, companyId)
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.PLATFORM_ADMIN,
  )
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  getOne(@Req() req: any, @Param('id') id: string, @Query('companyId') companyId?: string) {
    return this.svc.getOne(req.user.companyId, req.user.role as UserRole, req.user.id, id, companyId)
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MASTER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  create(@Req() req: any, @Body() dto: CreateLocationDto, @Query('companyId') companyId?: string) {
    return this.svc.create(req.user.companyId, req.user.role as UserRole, dto, companyId)
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MASTER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.svc.update(req.user.companyId, id, dto)
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MASTER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  setStatus(@Req() req: any, @Param('id') id: string, @Body() dto: SetLocationStatusDto) {
    return this.svc.setStatus(req.user.companyId, id, dto.isActive)
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MASTER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  softDelete(@Req() req: any, @Param('id') id: string) {
    return this.svc.softDelete(req.user.companyId, id)
  }

  @Patch(':id/restore')
  @Roles(UserRole.ADMIN, UserRole.MASTER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  restore(@Req() req: any, @Param('id') id: string) {
    return this.svc.restore(req.user.companyId, id)
  }
}