import { Body, Controller, Get, Patch, Post, Put, Param, Query, Req, UseGuards } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermission } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions.constants';

import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { BoardQueryDto } from './dto/board-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly svc: TicketsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.TICKETS_CREATE)
  create(@Req() req: any, @Body() dto: CreateTicketDto) {
    return this.svc.create(req.user.companyId, req.user.role as UserRole, dto);
  }

  @Post(':id/child')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.TICKETS_CREATE)
  createChild(@Req() req: any, @Param('id') id: string, @Body() dto: CreateChildTicketDto) {
    return this.svc.createChild(req.user.companyId, req.user.role as UserRole, id, dto);
  }

  @Get('board')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  board(@Req() req: any, @Query() q: BoardQueryDto) {
    const statuses: TicketStatus[] | undefined = q.status;

    return this.svc.board(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      {
        statuses,
        assigneeId: q.assigneeId,
        sla: q.sla,
        q: q.q,
        take: q.take,
      },
      req.accessFlags,
    );
  }

  /**
   * TECHNICIAN:
   * - по умолчанию видит только assigned_to_me
   * - “доступные” — отдельный endpoint /tickets/available
   * - “видит всё company” — тумблер через UserPermission(TICKETS_VIEW_ALL_COMPANY)
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  list(@Req() req: any, @Query('status') status?: TicketStatus) {
    return this.svc.list(req.user.companyId, req.user.id, req.user.role as UserRole, status, req.accessFlags);
  }

  @Get('available')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW_AVAILABLE)
  available(@Req() req: any) {
    return this.svc.availableForTechnician(req.user.companyId, req.user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.getOne(req.user.companyId, req.user.id, req.user.role as UserRole, id, req.accessFlags);
  }

  @Put(':id/assign/:technicianId')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.TICKETS_ASSIGN)
  assign(@Req() req: any, @Param('id') id: string, @Param('technicianId') technicianId: string) {
    return this.svc.assign(req.user.companyId, req.user, id, technicianId);
  }

  @Post(':id/claim')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_CLAIM)
  claim(@Req() req: any, @Param('id') id: string) {
    return this.svc.claim(req.user.companyId, req.user.id, id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_STATUS_CHANGE)
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.svc.updateStatus(req.user.companyId, req.user, req.user.role, id, dto);
  }
}
