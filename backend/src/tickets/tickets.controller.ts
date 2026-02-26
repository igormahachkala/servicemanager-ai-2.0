import { Body, Controller, Get, Patch, Post, Put, Param, Query, Req, UseGuards } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly svc: TicketsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateTicketDto) {
    return this.svc.create(req.user.companyId, req.user.role as UserRole, dto);
  }

  @Post(':id/child')
  createChild(@Req() req: any, @Param('id') id: string, @Body() dto: CreateChildTicketDto) {
    return this.svc.createChild(req.user.companyId, req.user.role as UserRole, id, dto);
  }

  @Get()
  list(@Req() req: any, @Query('status') status?: TicketStatus) {
    return this.svc.list(req.user.companyId, status);
  }

  @Get(':id')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.getOne(req.user.companyId, id);
  }

  @Put(':id/assign/:technicianId')
  assign(@Req() req: any, @Param('id') id: string, @Param('technicianId') technicianId: string) {
    return this.svc.assign(req.user.companyId, id, technicianId);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'DISPATCHER', 'TECHNICIAN')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.svc.updateStatus(req.user.companyId, req.user, req.user.role, id, dto);
  }
}
