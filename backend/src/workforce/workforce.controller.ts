import { Body, Controller, Get, Patch, Post, Param, Query, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PermissionsGuard } from '../common/permissions.guard'
import { PERMISSIONS } from '../common/permissions.constants'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { CloseWorkShiftDto } from './dto/close-work-shift.dto'
import { UpdateWorkforceSettingsDto } from './dto/update-workforce-settings.dto'
import { WorkforceService } from './workforce.service'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('workforce')
export class WorkforceController {
  constructor(private readonly workforce: WorkforceService) {}

  @Get('me')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.WORKFORCE_SHIFT_USE)
  getMyState(@Req() req: any) {
    return this.workforce.getMyState(this.actor(req))
  }

  @Post('shifts/open')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.WORKFORCE_SHIFT_USE)
  openShift(@Req() req: any) {
    return this.workforce.openShift(this.actor(req))
  }

  @Post('shifts/close')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.WORKFORCE_SHIFT_USE)
  closeShift(@Req() req: any, @Body() dto: CloseWorkShiftDto) {
    return this.workforce.closeShift(this.actor(req), dto.comment)
  }

  @Post('work-logs/tickets/:ticketId/start')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.WORKFORCE_SHIFT_USE)
  startTicketWork(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
    @Query('linkedClientCompanyId') linkedClientCompanyId?: string,
  ) {
    return this.workforce.startTicketWork(this.actor(req), ticketId, linkedClientCompanyId)
  }

  @Post('work-logs/tickets/:ticketId/stop')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.WORKFORCE_SHIFT_USE)
  stopTicketWork(@Req() req: any, @Param('ticketId') ticketId: string) {
    return this.workforce.stopTicketWork(this.actor(req), ticketId)
  }

  @Get('shifts')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TERRITORIAL_MANAGER,
  )
  @RequirePermission(PERMISSIONS.WORKFORCE_VIEW)
  list(
    @Req() req: any,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    return this.workforce.listWorkforce({
      actor: this.actor(req),
      observerCompanyId: companyId,
      from,
      to,
      userId,
    })
  }

  @Patch('settings')
  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.COMPANY_SETTINGS_EDIT)
  updateSettings(@Req() req: any, @Body() dto: UpdateWorkforceSettingsDto) {
    return this.workforce.updateSettings(req.user.companyId, dto.shiftAutoCloseTime)
  }

  private actor(req: any) {
    return {
      id: req.user.id,
      companyId: req.user.companyId,
      role: req.user.role as UserRole,
      accessFlags: req.accessFlags,
    }
  }
}
