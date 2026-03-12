import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { RequirePermission } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions.constants';

import { TimelineService } from './timeline.service';

@Controller('timeline')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('tickets/:id')
  @RequirePermission(PERMISSIONS.TICKETS_VIEW)
  async getTicketTimeline(@Param('id') id: string, @Req() req: any) {
    // user формируем в формате UserCtx из tickets.policy.ts
    const user = {
      id: req.user.id,
      role: req.user.role,
      companyId: req.user.companyId,
      accessFlags: req.accessFlags,
    };

    return this.timelineService.getTicketTimeline(user, id);
  }
}
