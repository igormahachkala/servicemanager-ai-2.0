import { Body, Controller, Delete, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import {
  ClearNotificationPreferenceDto,
  UpdateNotificationPreferenceDto,
} from './dto/update-notification-preference.dto';
import { NotificationSettingsService } from './notification-settings.service';
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
    private readonly settings: NotificationSettingsService,
  ) {}

  /**
   * 105C: личные настройки уведомлений текущего пользователя.
   *
   * Роли перечислены те же, что и у чтения уведомлений: настраивать свои
   * уведомления может каждый, кто их получает. Актор берётся только из токена —
   * чужие настройки этими ручками недостижимы, а сама настройка ничего
   * не открывает: она может лишь погасить уже разрешённое доставкой.
   */
  @Get('preferences')
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.CLIENT_ADMIN,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
  )
  getPreferences(@Req() req: any) {
    return this.settings.getSettings(this.actor(req));
  }

  @Patch('preferences')
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.CLIENT_ADMIN,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
  )
  updatePreference(@Req() req: any, @Body() dto: UpdateNotificationPreferenceDto) {
    return this.settings.disable(this.actor(req), dto);
  }

  /** Снять личное переопределение — вернуться к умолчанию. */
  @Delete('preferences')
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.CLIENT_ADMIN,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
  )
  clearPreference(@Req() req: any, @Query() dto: ClearNotificationPreferenceDto) {
    return this.settings.reset(this.actor(req), dto);
  }

  private actor(req: any) {
    return {
      id: req.user.id,
      companyId: req.user.companyId,
      role: req.user.role,
    };
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.CLIENT_ADMIN,
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
    UserRole.CLIENT_ADMIN,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
    UserRole.PLATFORM_ADMIN,
  )
  async unreadCount(@Req() req: any) {
    const unreadCount = await this.notifications.unreadCountForUser(req.user.companyId, req.user.id);
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
    UserRole.CLIENT_ADMIN,
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
    UserRole.CLIENT_ADMIN,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.STAFF,
    UserRole.PLATFORM_ADMIN,
  )
  markOneRead(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markOneRead(req.user.companyId, req.user.id, id);
  }
}
