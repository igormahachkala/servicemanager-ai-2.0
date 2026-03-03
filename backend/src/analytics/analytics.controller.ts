import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermission } from '../common/permissions.decorator';

import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('overview')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR)
  @RequirePermission('ANALYTICS_VIEW')
  overview(@Req() req: any) {
    return this.svc.overview(req.user.companyId);
  }
}
