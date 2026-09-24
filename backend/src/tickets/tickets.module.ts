import { Module } from '@nestjs/common'

import { TicketsController } from './tickets.controller'
import { TicketsService } from './tickets.service'

import { TicketsQueryService } from './tickets.query.service'
import { TicketsAssignmentService } from './tickets.assignment.service'
import { TicketsStatusService } from './tickets.status.service'
import { TicketAttachmentsService } from './ticket-attachments.service'
import { TicketsAcceptanceService } from './tickets.acceptance.service'

import { AssignmentModule } from '../assignment/assignment.module'
import { PrismaModule } from '../prisma/prisma.module'
import { PermissionsContextGuard } from '../common/permissions-context.guard'
import { TimelineModule } from '../timeline/timeline.module'
import { ServiceContractsModule } from '../service-contracts/service-contracts.module'
import { TechniciansModule } from '../technicians/technicians.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { WorkforceModule } from '../workforce/workforce.module'

@Module({
  imports: [
    PrismaModule,
    AssignmentModule,
    TimelineModule,
    ServiceContractsModule,
    TechniciansModule,
    NotificationsModule,
    WorkforceModule,
  ],
  providers: [
    TicketsService,
    TicketsQueryService,
    TicketsAssignmentService,
    TicketsStatusService,
    TicketAttachmentsService,
    TicketsAcceptanceService,
    PermissionsContextGuard,
  ],
  controllers: [TicketsController],
  exports: [TicketsService, TicketAttachmentsService],
})
export class TicketsModule {}
