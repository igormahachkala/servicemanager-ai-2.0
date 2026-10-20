import { Module } from '@nestjs/common'

import { InspectionController } from './inspection.controller'
import { InspectionService } from './inspection.service'
import { InspectionExportService } from './inspection.export.service'

import { TicketsModule } from '../tickets/tickets.module'
import { TimelineModule } from '../timeline/timeline.module'

@Module({
  imports: [TicketsModule, TimelineModule],
  controllers: [InspectionController],
  providers: [InspectionService, InspectionExportService],
})
export class InspectionModule {}