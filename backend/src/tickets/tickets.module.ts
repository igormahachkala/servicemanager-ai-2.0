import { Module } from '@nestjs/common';

import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

import { TicketsQueryService } from './tickets.query.service';
import { TicketsAssignmentService } from './tickets.assignment.service';
import { TicketsStatusService } from './tickets.status.service';

import { AssignmentModule } from '../assignment/assignment.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsContextGuard } from '../common/permissions-context.guard';

@Module({
  imports: [PrismaModule, AssignmentModule],
  providers: [
    TicketsService,
    TicketsQueryService,
    TicketsAssignmentService,
    TicketsStatusService,
    PermissionsContextGuard,
  ],
  controllers: [TicketsController],
})
export class TicketsModule {}
