import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermission } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions.constants';

import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly svc: EquipmentService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  create(@Req() req: any, @Body() dto: CreateEquipmentDto) {
    return this.svc.create(req.user.companyId, dto);
  }

  @Get('location/:locationId')
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
  findAllByLocation(@Req() req: any, @Param('locationId') locationId: string) {
    return this.svc.findAllByLocation(req.user.companyId, req.user.id, req.user.role as UserRole, locationId);
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
  )
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.companyId, req.user.id, req.user.role as UserRole, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.svc.update(req.user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.companyId, id);
  }
}