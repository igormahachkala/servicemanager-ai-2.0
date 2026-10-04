import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { ManagementSurface } from '../common/management-surface-access';
import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { PERMISSIONS } from '../common/permissions.constants';
import { RequirePermission } from '../common/permissions.decorator';
import { PermissionsGuard } from '../common/permissions.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import {
  ConsumeMaterialDto,
  CreateMaterialDto,
  IssueMaterialDto,
  MaterialQuantityDto,
  PurchaseMaterialDto,
  UpdateMaterialDto,
} from './dto/materials.dto';
import { MaterialsService } from './materials.service';

const MANAGEMENT_ROLES = [
  UserRole.ADMIN,
  UserRole.CLIENT_ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
] as const;

const TICKET_READ_ROLES = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.TECHNICIAN,
  UserRole.CLIENT,
] as const;

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get()
  @Roles(...MANAGEMENT_ROLES, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  list(@Req() req: any) {
    return this.materials.list(req.user.companyId);
  }

  @Post()
  @ManagementSurface()
  @Roles(...MANAGEMENT_ROLES)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  create(@Req() req: any, @Body() dto: CreateMaterialDto) {
    return this.materials.create(req.user.companyId, dto);
  }

  @Patch(':materialId')
  @ManagementSurface()
  @Roles(...MANAGEMENT_ROLES)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  update(
    @Req() req: any,
    @Param('materialId') materialId: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materials.update(req.user.companyId, materialId, dto);
  }

  @Get('me/balances')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  getMyBalances(@Req() req: any) {
    return this.materials.getMyBalances(req.user);
  }

  @Get('me/movements')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  getMyMovements(@Req() req: any) {
    return this.materials.getMyMovements(req.user);
  }

  @Post('me/purchases')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  purchase(@Req() req: any, @Body() dto: PurchaseMaterialDto) {
    return this.materials.purchase(req.user, dto);
  }

  @Post('me/consumptions')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  consume(@Req() req: any, @Body() dto: ConsumeMaterialDto) {
    return this.materials.consume(req.user, dto);
  }

  @Get('technicians/:technicianId/balances')
  @ManagementSurface()
  @Roles(...MANAGEMENT_ROLES)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  getTechnicianBalances(
    @Req() req: any,
    @Param('technicianId') technicianId: string,
  ) {
    return this.materials.getTechnicianBalances(
      req.user.companyId,
      technicianId,
    );
  }

  @Get('technicians/:technicianId/movements')
  @ManagementSurface()
  @Roles(...MANAGEMENT_ROLES)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  getTechnicianMovements(
    @Req() req: any,
    @Param('technicianId') technicianId: string,
  ) {
    return this.materials.getTechnicianMovements(
      req.user.companyId,
      technicianId,
    );
  }

  @Post('issues')
  @ManagementSurface()
  @Roles(...MANAGEMENT_ROLES)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  issue(@Req() req: any, @Body() dto: IssueMaterialDto) {
    return this.materials.issue(req.user, dto);
  }

  @Post('stock/receipts')
  @ManagementSurface()
  @Roles(...MANAGEMENT_ROLES)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  receiptToCompanyStock(@Req() req: any, @Body() dto: MaterialQuantityDto) {
    return this.materials.receiptToCompanyStock(req.user, dto);
  }

  @Get('tickets/:ticketId/consumptions')
  @Roles(...TICKET_READ_ROLES)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  getTicketConsumptions(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
    @Query('linkedClientCompanyId') linkedClientCompanyId?: string,
  ) {
    return this.materials.getTicketConsumptions(
      req.user,
      ticketId,
      linkedClientCompanyId,
    );
  }
}
