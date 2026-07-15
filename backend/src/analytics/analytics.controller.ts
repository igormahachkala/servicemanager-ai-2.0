import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'

import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'

import { AnalyticsService } from './analytics.service'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('categories')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.PLATFORM_ADMIN)
  @RequirePermission(PERMISSIONS.ANALYTICS_VIEW)
  categories(@Req() req: any) {
    return this.svc.getCategoriesAnalytics(req.user.companyId, req.user.id, req.user.role as UserRole)
  }

  @Get('specializations')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.PLATFORM_ADMIN)
  @RequirePermission(PERMISSIONS.ANALYTICS_VIEW)
  specializations(@Req() req: any) {
    return this.svc.getSpecializationsAnalytics(req.user.companyId, req.user.id, req.user.role as UserRole)
  }

  @Get('workload')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.PLATFORM_ADMIN)
  @RequirePermission(PERMISSIONS.ANALYTICS_VIEW)
  workload(@Req() req: any) {
    return this.svc.getWorkloadAnalytics(req.user.companyId, req.user.id, req.user.role as UserRole)
  }

  @Get('locations')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.PLATFORM_ADMIN)
  @RequirePermission(PERMISSIONS.ANALYTICS_VIEW)
  locations(
    @Req() req: any,
    @Query('linkedClientCompanyId') linkedClientCompanyId?: string,
    @Query('companyId') companyId?: string,
    @Query('locationId') locationId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('minTickets') minTickets?: string,
  ) {
    return this.svc.getLocationsAnalytics(req.user.companyId, req.user.id, req.user.role as UserRole, {
      companyId,
      linkedClientCompanyId,
      locationId,
      categoryId,
      from,
      to,
      minTickets: minTickets ? Math.max(1, parseInt(minTickets, 10) || 1) : undefined,
    })
  }

  @Get('overview')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.PLATFORM_ADMIN)
  @RequirePermission(PERMISSIONS.ANALYTICS_VIEW)
  overview(
    @Req() req: any,
    @Query('linkedClientCompanyId') linkedClientCompanyId?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.svc.overview(req.user.companyId, req.user.id, req.user.role as UserRole, companyId, linkedClientCompanyId)
  }
}