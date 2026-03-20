import { Module } from '@nestjs/common';

import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

import { TicketsQueryService } from './tickets.query.service';
import { TicketsAssignmentService } from './tickets.assignment.service';
import { TicketsStatusService } from './tickets.status.service';
import { TicketAttachmentsService } from './ticket-attachments.service';

import { AssignmentModule } from '../assignment/assignment.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { TimelineModule } from '../timeline/timeline.module';

@Module({
  imports: [PrismaModule, AssignmentModule, TimelineModule],
  providers: [
    TicketsService,
    TicketsQueryService,
    TicketsAssignmentService,
    TicketsStatusService,
    TicketAttachmentsService,
    PermissionsContextGuard,
  ],
  controllers: [TicketsController],
})
export class TicketsModule {}
