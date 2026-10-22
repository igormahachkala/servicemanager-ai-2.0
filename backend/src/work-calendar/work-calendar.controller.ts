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
 * SMA-WORK-CALENDAR-V1. Право — TICKETS_VIEW, как у чтения заявок: календарь
 * показывает заявки в их действующем scope, планы обходов и справочник
 * объектов сервис добавляет, только если у актора есть и доступ к ним.
 *
 * Роли — те же, что у GET /tickets/board, включая CLIENT_ADMIN (решение
 * владельца). У CLIENT_ADMIN в матрице TICKETS_VIEW и WORKFORCE_VIEW, без
 * LOCATIONS_VIEW: он видит заявки своей компании в пределах своих привязок,
 * а обходов, справочника объектов и штата не получает.
 */
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('work-calendar')
export class WorkCalendarController {
  constructor(private readonly calendar: WorkCalendarService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.CLIENT_ADMIN,
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
    @Query('eventTypes') eventTypes?: string | string[],
    @Query('types') types?: string | string[],
    @Query('statuses') statuses?: string | string[],
    @Query('assigned') assigned?: string,
    @Query('includeUnscheduled') includeUnscheduled?: string,
    @Query('includeCompleted') includeCompleted?: string,
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
        eventTypes,
        types,
        statuses,
        assigned,
        includeUnscheduled,
        includeCompleted,
      },
    );
  }
}
