import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermission } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions.constants';

import { EquipmentPartsService } from './equipment-parts.service';
import { CreatePartDefinitionDto } from './dto/parts.dto';

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * Справочник комплектующих. Складского в нём нет: остатки, цены и резервы —
 * это будущий Stock, отдельная сущность за швом PartDefinition → Stock.
 */
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('part-definitions')
export class PartDefinitionsController {
  constructor(private readonly parts: EquipmentPartsService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.PLATFORM_ADMIN,
  )
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  list(
    @Req() req: any,
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
  ) {
    return this.parts.listDefinitions(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      { companyId, search },
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  create(@Req() req: any, @Body() dto: CreatePartDefinitionDto) {
    return this.parts.createDefinition(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      dto,
    );
  }
}
