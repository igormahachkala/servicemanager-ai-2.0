import { Body, Controller, Get, Patch, Post, Put, Param, Query, Req, UseGuards } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermission } from '../common/permissions.decorator';

import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly svc: TicketsService) {}

  /**
   * SECURITY_MODEL.md:
   * - Only ADMIN/DISPATCHER create tickets
   * Мы также допускаем MASTER (в проекте он есть) как админскую роль.
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission('TICKETS_CREATE')
  create(@Req() req: any, @Body() dto: CreateTicketDto) {
    return this.svc.create(req.user.companyId, req.user.role as UserRole, dto);
  }

  @Post(':id/child')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission('TICKETS_CREATE')
  createChild(@Req() req: any, @Param('id') id: string, @Body() dto: CreateChildTicketDto) {
    return this.svc.createChild(req.user.companyId, req.user.role as UserRole, id, dto);
  }

  /**
   * Важно (официальное решение):
   * TECHNICIAN может читать чужие тикеты внутри company.
   * Scope обеспечивается на уровне service (в дальнейшем уйдёт в Policy слой).
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission('TICKETS_VIEW')
  list(@Req() req: any, @Query('status') status?: TicketStatus) {
    return this.svc.list(req.user.companyId, req.user.id, req.user.role as UserRole, status);
  }

  @Get('available')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission('TICKETS_VIEW_AVAILABLE')
  available(@Req() req: any) {
    return this.svc.availableForTechnician(req.user.companyId, req.user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission('TICKETS_VIEW')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.getOne(req.user.companyId, req.user.id, req.user.role as UserRole, id);
  }

  @Put(':id/assign/:technicianId')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission('TICKETS_ASSIGN')
  assign(@Req() req: any, @Param('id') id: string, @Param('technicianId') technicianId: string) {
    return this.svc.assign(req.user.companyId, req.user, id, technicianId);
  }

  @Post(':id/claim')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission('TICKETS_CLAIM')
  claim(@Req() req: any, @Param('id') id: string) {
    return this.svc.claim(req.user.companyId, req.user.id, id);
  }

  /**
   * SECURITY_MODEL.md: “Only TECHNICIAN assigned can change status (future enforcement)”
   * Сейчас enforcement в service: TECHNICIAN только свои (assigned to self).
   * Управленческие роли: ADMIN/MASTER/DISPATCHER/NETWORK_DIRECTOR.
   */
  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission('TICKETS_STATUS_CHANGE')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.svc.updateStatus(req.user.companyId, req.user, req.user.role, id, dto);
  }
}
