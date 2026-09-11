import {
  Body,
  Controller,
  Headers,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'
import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'
import { ManagementSurface } from '../common/management-surface-access'

import { InspectionService } from './inspection.service'
import { InspectionScheduleService } from './inspection-schedule.service'
import { CreateTemplateDto } from './dto/create-template.dto'
import { CreateScheduleDto } from './dto/create-schedule.dto'
import { ListSchedulesDto } from './dto/list-schedules.dto'
import { UpdateScheduleDto } from './dto/update-schedule.dto'
import { StartRunDto } from './dto/start-run.dto'
import { UpdateRunItemDto } from './dto/update-run-item.dto'
import { CreateTicketFromItemDto } from './dto/create-ticket-from-item.dto'
import { SubmitRunReportDto } from './dto/submit-run-report.dto'
import { ReviewRunReportDto } from './dto/review-run-report.dto'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('inspection')
export class InspectionController {
  constructor(
    private readonly svc: InspectionService,
    private readonly schedules: InspectionScheduleService,
  ) {}

  /**
   * SMA-ROUNDS-V1-SCHEDULE-CRUD-098 — schedule routes.
   *
   * Paths match the client functions that already exist in web/src/lib/api.ts. Management
   * routes require LOCATIONS_MANAGE, the same canonical grant that gates template management,
   * so ADMIN / MASTER / DISPATCHER can plan and TECHNICIAN cannot. Reading only requires
   * LOCATIONS_VIEW, and the service narrows a non-manager to their own assignments.
   *
   * Declared before the run routes so `runs/:id` can never swallow a schedules path.
   */

  @Get('schedules')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  listSchedules(@Req() req: any, @Query() query: ListSchedulesDto) {
    return this.schedules.list(this.userFromRequest(req), query)
  }

  @Get('schedules/:id')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  getSchedule(@Req() req: any, @Param('id') scheduleId: string) {
    return this.schedules.get(this.userFromRequest(req), scheduleId)
  }

  @Post('schedules')
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  createSchedule(@Req() req: any, @Body() dto: CreateScheduleDto) {
    return this.schedules.create(this.userFromRequest(req), dto)
  }

  @Patch('schedules/:id')
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  updateSchedule(@Req() req: any, @Param('id') scheduleId: string, @Body() dto: UpdateScheduleDto) {
    return this.schedules.update(this.userFromRequest(req), scheduleId, dto)
  }

  @Delete('schedules/:id')
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  deleteSchedule(@Req() req: any, @Param('id') scheduleId: string) {
    return this.schedules.remove(this.userFromRequest(req), scheduleId)
  }

  @Get('templates')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  listTemplates(@Req() req: any) {
    return this.svc.listTemplates(this.userFromRequest(req))
  }

  @Post('templates')
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR)
  @RequirePermission(PERMISSIONS.LOCATIONS_MANAGE)
  createTemplate(@Req() req: any, @Body() dto: CreateTemplateDto) {
    return this.svc.createTemplate(this.userFromRequest(req), dto)
  }

  @Get('runs')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  listRuns(@Req() req: any) {
    return this.svc.listRuns(this.userFromRequest(req))
  }

  @Post('runs')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  startRun(@Req() req: any, @Body() dto: StartRunDto) {
    return this.svc.startRun(this.userFromRequest(req), dto)
  }

  @Get('runs/:id/report')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  getRunReport(@Req() req: any, @Param('id') runId: string) {
    return this.svc.getRunReport(this.userFromRequest(req), runId)
  }

  @Get('runs/:id/report/export')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  async exportRunReport(
    @Req() req: any,
    @Param('id') runId: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: any,
  ) {
    const exported = await this.svc.exportRunReport(this.userFromRequest(req), runId, format)
    res.setHeader('Content-Type', exported.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`)
    return new StreamableFile(exported.buffer)
  }

  @Post('runs/:id/report/submit')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  submitRunReport(@Req() req: any, @Param('id') runId: string, @Body() _dto: SubmitRunReportDto) {
    return this.svc.submitRunReport(this.userFromRequest(req), runId)
  }

  @Post('runs/:id/report/review')
  @ManagementSurface()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  reviewRunReport(@Req() req: any, @Param('id') runId: string, @Body() dto: ReviewRunReportDto) {
    return this.svc.reviewRunReport(this.userFromRequest(req), runId, dto)
  }

  @Get('runs/:id')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  getRun(@Req() req: any, @Param('id') runId: string) {
    return this.svc.getRun(this.userFromRequest(req), runId)
  }

  @Patch('runs/:runId/items/:itemId')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  updateRunItem(@Req() req: any, @Param('runId') runId: string, @Param('itemId') itemId: string, @Body() dto: UpdateRunItemDto) {
    return this.svc.updateRunItem(this.userFromRequest(req), runId, itemId, dto)
  }

  @Post('runs/:runId/items/:itemId/attachments')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadRunItemAttachment(
    @Req() req: any,
    @Param('runId') runId: string,
    @Param('itemId') itemId: string,
    @UploadedFile() file: any,
    /** 113B: present for a replayable offline-queued photo, absent for online callers. */
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.svc.uploadRunItemAttachment(this.userFromRequest(req), runId, itemId, file, idempotencyKey)
  }

  @Post('runs/:runId/items/:itemId/create-ticket')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  createTicketFromItem(
    @Req() req: any,
    @Param('runId') runId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CreateTicketFromItemDto,
    /** 113B: present for a replayable offline-queued ticket, absent for online callers. */
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.svc.createTicketFromItem(this.userFromRequest(req), runId, itemId, dto, idempotencyKey)
  }

  @Post('runs/:id/complete')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  completeRun(@Req() req: any, @Param('id') runId: string) {
    return this.svc.completeRun(this.userFromRequest(req), runId)
  }

  private userFromRequest(req: any) {
    return {
      id: req.user.id,
      companyId: req.user.companyId,
      role: req.user.role,
    }
  }
}
