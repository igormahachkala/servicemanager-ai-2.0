import {
  Body,
  Controller,
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

import { InspectionService } from './inspection.service'
import { CreateTemplateDto } from './dto/create-template.dto'
import { StartRunDto } from './dto/start-run.dto'
import { UpdateRunItemDto } from './dto/update-run-item.dto'
import { CreateTicketFromItemDto } from './dto/create-ticket-from-item.dto'
import { SubmitRunReportDto } from './dto/submit-run-report.dto'
import { ReviewRunReportDto } from './dto/review-run-report.dto'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('inspection')
export class InspectionController {
  constructor(private readonly svc: InspectionService) {}

  @Get('templates')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  listTemplates(@Req() req: any) {
    return this.svc.listTemplates(this.userFromRequest(req))
  }

  @Post('templates')
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
  @UseInterceptors(FileInterceptor('file'))
  uploadRunItemAttachment(@Req() req: any, @Param('runId') runId: string, @Param('itemId') itemId: string, @UploadedFile() file: any) {
    return this.svc.uploadRunItemAttachment(this.userFromRequest(req), runId, itemId, file)
  }

  @Post('runs/:runId/items/:itemId/create-ticket')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.LOCATIONS_VIEW)
  createTicketFromItem(@Req() req: any, @Param('runId') runId: string, @Param('itemId') itemId: string, @Body() dto: CreateTicketFromItemDto) {
    return this.svc.createTicketFromItem(this.userFromRequest(req), runId, itemId, dto)
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