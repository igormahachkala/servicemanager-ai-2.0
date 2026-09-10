import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { ManagementSurface } from '../common/management-surface-access';
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
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  create(@Req() req: any, @Body() dto: CreateEquipmentDto) {
    return this.svc.create(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      dto,
    );
  }

  /**
   * SMA-EQUIPMENT-V2-110A.
   * Список парка компании: поиск и фильтры. Роли для чтения те же, что у выборки
   * по площадке — отдельного набора прав не заводится.
   */
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
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAllByCompany(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      { companyId, locationId, status, search },
    );
  }

  /**
   * Загрузка снимка. Право на запись — то же, что у создания и правки, поэтому
   * SECONDARY-провайдер сюда не проходит.
   */
  @Post(':id/photos')
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadPhoto(@Req() req: any, @Param('id') id: string, @UploadedFile() file: any) {
    return this.svc.uploadPhoto(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      id,
      file,
    );
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
  findAllByLocation(
    @Req() req: any,
    @Param('locationId') locationId: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.svc.findAllByLocation(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      locationId,
      companyId,
    );
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
  findOne(
    @Req() req: any,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.svc.findOne(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      id,
      companyId,
    );
  }

  @Patch(':id')
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.svc.update(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      id,
      dto,
    );
  }

  @Delete(':id')
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      id,
    );
  }
}
