import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import {
  UpdateCompanyNotificationRolePreferenceDto,
  UpdateUserNotificationPreferenceDto,
} from './dto/notification-preferences.dto';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsService } from './notifications.service';

/**
 * In-app уведомления: GET возвращает { items, unreadCount };
 * PATCH read-all — массовое прочтение в рамках tenant+user;
 * PATCH :id/read — одно уведомление (404 если не своё).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {}

  @Get('preferences/catalog')
  @Roles(
    UserRole.ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
    UserRole.PLATFORM_ADMIN,
  )
  preferenceCatalog(@Req() req: any) {
    return this.notificationPreferences.getPreferenceCatalog(req.user);
  }

  @Get('preferences/company-role-matrix')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  companyRolePreferenceMatrix(
    @Req() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.notificationPreferences.getCompanyRoleMatrix(
      req.user,
      companyId,
    );
  }

  @Patch('preferences/company-role')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  updateCompanyRolePreference(
    @Req() req: any,
    @Body() dto: UpdateCompanyNotificationRolePreferenceDto,
  ) {
    return this.notificationPreferences.updateCompanyRolePreference(
      req.user,
      dto,
    );
  }

  @Get('preferences/me')
  @Roles(
    UserRole.ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
    UserRole.PLATFORM_ADMIN,
  )
  myPreferences(@Req() req: any) {
    return this.notificationPreferences.getMyPreferences(req.user);
  }

  @Patch('preferences/me')
  @Roles(
    UserRole.ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
    UserRole.PLATFORM_ADMIN,
  )
  updateMyPreference(
    @Req() req: any,
    @Body() dto: UpdateUserNotificationPreferenceDto,
  ) {
    return this.notificationPreferences.updateMyPreference(req.user, dto);
  }

  @Get('preferences/users/:userId')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  userPreferences(@Req() req: any, @Param('userId') userId: string) {
    return this.notificationPreferences.getUserPreferences(req.user, userId);
  }

  @Patch('preferences/users/:userId')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  updateUserPreference(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserNotificationPreferenceDto,
  ) {
    return this.notificationPreferences.updateUserPreference(
      req.user,
      userId,
      dto,
    );
  }

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

  @Get('unread-count')
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
  async unreadCount(@Req() req: any) {
    const unreadCount = await this.notifications.unreadCountForUser(
      req.user.companyId,
      req.user.id,
    );
    return { unreadCount };
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
