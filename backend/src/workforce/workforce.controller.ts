import { Body, Controller, Get, Patch, Post, Param, Query, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PermissionsGuard } from '../common/permissions.guard'
import { PERMISSIONS } from '../common/permissions.constants'
import { Roles } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { ManagementSurface } from '../common/management-surface-access'
import { CloseWorkShiftDto } from './dto/close-work-shift.dto'
import { CreateArrivalCorrectionDto } from './dto/create-arrival-correction.dto'
import { CreateShiftCorrectionDto } from './dto/create-shift-correction.dto'
import { UpdateShiftGeoDto } from './dto/update-shift-geo.dto'
import { UpdateWorkforceSettingsDto } from './dto/update-workforce-settings.dto'
import { WorkforceGeoService } from './workforce-geo.service'
import { WorkforceOnSiteCorrectionService } from './workforce-on-site-correction.service'
import { WorkforceOnSiteReadService } from './workforce-on-site-read.service'
import { WorkforceTechnicianMapService } from './workforce-technician-map.service'
import { WorkforceService } from './workforce.service'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('workforce')
export class WorkforceController {
  constructor(
    private readonly workforce: WorkforceService,
    private readonly workforceGeo: WorkforceGeoService,
    private readonly onSiteRead: WorkforceOnSiteReadService,
    private readonly onSiteCorrection: WorkforceOnSiteCorrectionService,
    private readonly technicianMap: WorkforceTechnicianMapService,
  ) {}

  @Get('me')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.WORKFORCE_SHIFT_USE)
  getMyState(@Req() req: any) {
    return this.workforce.getMyState(this.actor(req))
  }

  @Post('me/geo')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.WORKFORCE_SHIFT_USE)
  updateMyGeo(@Req() req: any, @Body() dto: UpdateShiftGeoDto) {
    return this.workforceGeo.updateMyPoint(this.actor(req), dto)
  }

  @Get('on-site')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  listOnSite(
    @Req() req: any,
    @Query('state') state?: string,
    @Query('shift') shift?: string,
    @Query('technician') technician?: string,
    @Query('sort') sort?: string,
  ) {
    return this.onSiteRead.list(this.actor(req), { state, shift, technician, sort })
  }

  @Get('on-site/tickets/:ticketId')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  getOnSiteTicket(@Req() req: any, @Param('ticketId') ticketId: string) {
    return this.onSiteRead.getTicket(this.actor(req), ticketId)
  }

  @Post('on-site/tickets/:ticketId/corrections')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  createOnSiteCorrection(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateArrivalCorrectionDto,
  ) {
    return this.onSiteCorrection.create(this.actor(req), ticketId, dto)
  }

  @Get('on-site/tickets/:ticketId/corrections')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  listOnSiteCorrections(@Req() req: any, @Param('ticketId') ticketId: string) {
    return this.onSiteCorrection.list(this.actor(req), ticketId)
  }

  @Get('technician-map')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  technicianMapList(@Req() req: any) {
    return this.technicianMap.list(this.actor(req))
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
  @ManagementSurface()
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.CLIENT_ADMIN,
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

  /**
   * SMA-SHIFT-LABOR-LEDGER-INTEGRITY-106B — correct a shift.
   *
   * Gated on USERS_MANAGE, the canonical grant for managing people in
   * common/permissions-matrix.ts: ADMIN (client and provider), MASTER+PROVIDER,
   * DISPATCHER+PROVIDER and NETWORK_DIRECTOR+CLIENT hold it; TECHNICIAN, TERRITORIAL_MANAGER
   * and CLIENT do not. That is exactly the boundary this task requires — a technician cannot
   * administratively rewrite their own history — and it is read off the existing matrix rather
   * than invented here. Tenant isolation is enforced in the service by companyId.
  */
  @Post('shifts/:shiftId/corrections')
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR)
  @RequirePermission(PERMISSIONS.USERS_MANAGE)
  createShiftCorrection(
    @Req() req: any,
    @Param('shiftId') shiftId: string,
    @Body() dto: CreateShiftCorrectionDto,
  ) {
    return this.workforce.createShiftCorrection(this.actor(req), shiftId, dto)
  }

  /** Correction history plus resolved effective time. Read-only, so WORKFORCE_VIEW is enough. */
  @Get('shifts/:shiftId')
  @ManagementSurface()
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TERRITORIAL_MANAGER,
  )
  @RequirePermission(PERMISSIONS.WORKFORCE_VIEW)
  getShift(@Req() req: any, @Param('shiftId') shiftId: string) {
    return this.workforce.getShiftWithCorrections(this.actor(req), shiftId)
  }

  @Patch('settings')
  @ManagementSurface()
  @Roles(UserRole.ADMIN)
  @RequirePermission(PERMISSIONS.COMPANY_SETTINGS_EDIT)
  updateSettings(@Req() req: any, @Body() dto: UpdateWorkforceSettingsDto) {
    return this.workforce.updateSettings(req.user.companyId, dto)
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
