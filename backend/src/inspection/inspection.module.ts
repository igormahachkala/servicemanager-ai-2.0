import { Module } from '@nestjs/common'

import { InspectionController } from './inspection.controller'
import { InspectionService } from './inspection.service'
import { InspectionExportService } from './inspection.export.service'
import { InspectionScheduleService } from './inspection-schedule.service'

import { ServiceContractsModule } from '../service-contracts/service-contracts.module'
import { TicketsModule } from '../tickets/tickets.module'
import { TimelineModule } from '../timeline/timeline.module'
import { WorkforceModule } from '../workforce/workforce.module'

@Module({
  imports: [TicketsModule, TimelineModule, ServiceContractsModule, WorkforceModule],
  controllers: [InspectionController],
  providers: [InspectionService, InspectionExportService, InspectionScheduleService],
})
export class InspectionModule {}
