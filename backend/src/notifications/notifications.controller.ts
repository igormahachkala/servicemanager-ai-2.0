import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
    UserRole.PLATFORM_ADMIN,
  )
  list(@Req() req: any) {
    return this.notifications.listForUser(req.user.companyId, req.user.id);
  }

  @Patch('read-all')
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
    UserRole.PLATFORM_ADMIN,
  )
  markAllRead(@Req() req: any) {
    return this.notifications.markAllRead(req.user.companyId, req.user.id);
  }

  @Patch(':id/read')
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
    UserRole.PLATFORM_ADMIN,
  )
  markOneRead(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markOneRead(req.user.companyId, req.user.id, id);
  }
}
