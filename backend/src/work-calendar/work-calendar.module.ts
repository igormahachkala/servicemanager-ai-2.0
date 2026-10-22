import { Module } from '@nestjs/common';

import { InspectionModule } from '../inspection/inspection.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsModule } from '../tickets/tickets.module';
import { WorkCalendarController } from './work-calendar.controller';
import { WorkCalendarService } from './work-calendar.service';

@Module({
  imports: [PrismaModule, TicketsModule, InspectionModule],
  controllers: [WorkCalendarController],
  providers: [WorkCalendarService],
})
export class WorkCalendarModule {}
