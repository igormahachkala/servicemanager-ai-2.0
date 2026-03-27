import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Param,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { TicketStatus, UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'

import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermission } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'

import { TicketsService } from './tickets.service'
import { CreateTicketDto } from './dto/create-ticket.dto'
import { CreateChildTicketDto } from './dto/create-child-ticket.dto'
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto'
import { BoardQueryDto } from './dto/board-query.dto'

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsContextGuard, PermissionsGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly svc: TicketsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.TICKETS_CREATE)
  create(@Req() req: any, @Body() dto: CreateTicketDto) {
    return this.svc.create(req.user.companyId, req.user.role as UserRole, dto)
  }

  @Post('attachments/upload')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.TICKETS_CREATE)
  @UseInterceptors(FileInterceptor('file'))
  uploadDraftAttachment(@Req() req: any, @UploadedFile() file: any) {
    return this.svc.uploadDraftAttachment(req.user.companyId, req.user.id, file)
  }

  @Delete('attachments/:attachmentId')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.TICKETS_CREATE)
  deleteDraftAttachment(@Req() req: any, @Param('attachmentId') attachmentId: string) {
    return this.svc.deleteDraftAttachment(req.user.companyId, attachmentId)
  }

  @Post(':id/child')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.TICKETS_CREATE)
  createChild(@Req() req: any, @Param('id') id: string, @Body() dto: CreateChildTicketDto) {
    return this.svc.createChild(req.user.companyId, req.user.role as UserRole, id, dto)
  }

  @Get('board')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  board(@Req() req: any, @Query() q: BoardQueryDto) {
    const statuses: TicketStatus[] | undefined = q.status

    return this.svc.board(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      {
        statuses,
        assigneeId: q.assigneeId,
        sla: q.sla,
        q: q.q,
        take: q.take,
      },
      req.accessFlags,
      q.linkedClientCompanyId,
    )
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  list(@Req() req: any, @Query('status') status?: TicketStatus, @Query('linkedClientCompanyId') linkedClientCompanyId?: string) {
    return this.svc.list(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      status,
      req.accessFlags,
      linkedClientCompanyId,
    )
  }

  @Get('available')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW_AVAILABLE)
  available(@Req() req: any) {
    return this.svc.availableForTechnician(req.user.companyId, req.user.id)
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.getOne(req.user.companyId, req.user.id, req.user.role as UserRole, id, req.accessFlags)
  }

  @Get(':id/attachments')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  listAttachments(@Req() req: any, @Param('id') id: string) {
    return this.svc.listAttachments(req.user.companyId, req.user.id, req.user.role as UserRole, id, req.accessFlags)
  }

  @Post(':id/attachments')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_STATUS_CHANGE)
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(@Req() req: any, @Param('id') id: string, @UploadedFile() file: any) {
    return this.svc.uploadTicketAttachment(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      id,
      file,
      req.accessFlags,
    )
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_STATUS_CHANGE)
  deleteAttachment(@Req() req: any, @Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.svc.deleteTicketAttachment(
      req.user.companyId,
      req.user.id,
      req.user.role as UserRole,
      id,
      attachmentId,
      req.accessFlags,
    )
  }

  @Get(':id/assignment-candidates')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.TICKETS_ASSIGN)
  assignmentCandidates(@Req() req: any, @Param('id') id: string) {
    return this.svc.listAssignmentCandidates(req.user.companyId, req.user, id)
  }

  @Put(':id/assign/:technicianId')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER)
  @RequirePermission(PERMISSIONS.TICKETS_ASSIGN)
  assign(@Req() req: any, @Param('id') id: string, @Param('technicianId') technicianId: string) {
    return this.svc.assign(req.user.companyId, req.user, id, technicianId)
  }

  @Post(':id/claim')
  @Roles(UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_CLAIM)
  claim(@Req() req: any, @Param('id') id: string) {
    return this.svc.claim(req.user.companyId, req.user.id, id)
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR, UserRole.TECHNICIAN)
  @RequirePermission(PERMISSIONS.TICKETS_STATUS_CHANGE)
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.svc.updateStatus(req.user.companyId, req.user, req.user.role, id, dto)
  }
}
