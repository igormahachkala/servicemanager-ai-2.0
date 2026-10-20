import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { PERMISSIONS } from '../common/permissions.constants';
import { RequirePermission } from '../common/permissions.decorator';
import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import { MapService } from './map.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('locations')
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
  )
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  listLocations(@Req() req: any) {
    return this.mapService.listLocations(req.user.companyId);
  }

  @Get('locations/:locationId')
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
  )
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  getLocation(@Req() req: any, @Param('locationId') locationId: string) {
    return this.mapService.getLocation(req.user.companyId, locationId);
  }
}