import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import { EndpointDto } from './dto/endpoint.dto';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UpdatePushPreferencesDto } from './dto/update-push-preferences.dto';
import { PushService } from './push.service';

/**
 * Web Push (mobile-поток). Контракт фронта — web/src/lib/api.ts (push-обёртки) и
 * web/public/sw.js. См. docs/PUSH_NOTIFICATIONS_ARCHITECTURE_V1.md §4.2.
 * Аутентификация — как везде в API (JwtAuthGuard + RolesGuard, tenant по req.user).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
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
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('vapid-public-key')
  vapidPublicKey() {
    return this.push.getVapidPublicKey();
  }

  @Post('subscriptions')
  subscribe(@Req() req: any, @Body() dto: SubscribePushDto) {
    return this.push.saveSubscription(
      req.user.id,
      req.user.companyId,
      dto,
      req.headers['user-agent'],
    );
  }

  @Delete('subscriptions')
  unsubscribe(@Req() req: any, @Body() dto: EndpointDto) {
    return this.push.removeSubscription(req.user.id, dto.endpoint);
  }

  @Post('subscriptions/heartbeat')
  heartbeat(@Req() req: any, @Body() dto: EndpointDto) {
    return this.push.heartbeat(req.user.id, dto.endpoint);
  }

  @Get('preferences')
  getPreferences(@Req() req: any) {
    return this.push.getPreferences(req.user.id);
  }

  @Patch('preferences')
  updatePreferences(@Req() req: any, @Body() dto: UpdatePushPreferencesDto) {
    return this.push.updatePreferences(req.user.id, dto);
  }

  @Post('test')
  test(@Req() req: any) {
    return this.push.sendTest(req.user.id);
  }
}
