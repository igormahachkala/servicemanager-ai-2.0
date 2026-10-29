import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermission } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions.constants';

import { MarkTicketChatReadDto } from './dto/mark-ticket-chat-read.dto';
import { TicketChatReadService } from './ticket-chat-read.service';
import { TimelineService } from './timeline.service';

@Controller('timeline')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimelineController {
  constructor(
    private readonly timelineService: TimelineService,
    private readonly ticketChatReadService: TicketChatReadService,
  ) {}

  @Get('tickets/:id')
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  async getTicketTimeline(
    @Param('id') id: string,
    @Req() req: any,
    @Query('linkedClientCompanyId') linkedClientCompanyId?: string,
    @Query('companyId') companyId?: string,
  ) {
    const user = {
      id: req.user.id,
      role: req.user.role,
      companyId: req.user.companyId,
      accessFlags: req.accessFlags,
    };

    return this.timelineService.getTicketTimeline(user, id, linkedClientCompanyId, companyId);
  }

  @Post('tickets/:id/read')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  async markTicketChatRead(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: MarkTicketChatReadDto,
    @Query('linkedClientCompanyId') linkedClientCompanyId?: string,
    @Query('companyId') companyId?: string,
  ) {
    const user = {
      id: req.user.id,
      role: req.user.role,
      companyId: req.user.companyId,
      accessFlags: req.accessFlags,
    };

    return this.ticketChatReadService.markRead(user, id, dto?.upTo, linkedClientCompanyId, companyId);
  }
}
