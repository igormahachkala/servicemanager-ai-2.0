import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { RequirePermission } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions.constants';
import { PermissionsGuard } from '../common/permissions.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import {
  WorkCalendarService,
  type WorkCalendarActor,
} from './work-calendar.service';

/**
 * SMA-WORK-CALENDAR-V1. Роли и право — те же, что у GET /tickets: календарь
 * показывает заявки в их действующем scope, планы обходов добавляются
 * сервисом, только если у актора есть и доступ к планам.
 */
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('work-calendar')
export class WorkCalendarController {
  constructor(private readonly calendar: WorkCalendarService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TECHNICIAN,
    UserRole.CLIENT,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.PLATFORM_ADMIN,
  )
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  @ApiForbiddenResponse({
    description: 'Missing permission: TICKETS_VIEW',
  })
  getCalendar(
    @Req()
    req: {
      user: { companyId: string; id: string; role: UserRole };
      accessFlags?: WorkCalendarActor['accessFlags'];
    },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('timezone') timezone?: string,
    @Query('linkedClientCompanyId') linkedClientCompanyId?: string,
    @Query('companyId') companyId?: string,
    @Query('employeeIds') employeeIds?: string | string[],
    @Query('locationIds') locationIds?: string | string[],
    @Query('types') types?: string | string[],
    @Query('statuses') statuses?: string | string[],
    @Query('includeUnscheduled') includeUnscheduled?: string,
  ) {
    return this.calendar.getCalendar(
      {
        companyId: req.user.companyId,
        id: req.user.id,
        role: req.user.role,
        accessFlags: req.accessFlags,
      },
      {
        from,
        to,
        timezone,
        linkedClientCompanyId,
        companyId,
        employeeIds,
        locationIds,
        types,
        statuses,
        includeUnscheduled,
      },
    );
  }
}
