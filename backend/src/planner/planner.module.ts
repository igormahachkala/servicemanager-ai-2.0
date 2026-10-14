import { Module } from '@nestjs/common'

import { InspectionModule } from '../inspection/inspection.module'
import { PrismaModule } from '../prisma/prisma.module'
import { TechniciansModule } from '../technicians/technicians.module'
import { TicketsModule } from '../tickets/tickets.module'
import { PlannerController } from './planner.controller'
import { PlannerService } from './planner.service'

@Module({
  imports: [PrismaModule, TicketsModule, TechniciansModule, InspectionModule],
  controllers: [PlannerController],
  providers: [PlannerService],
})
export class PlannerModule {}
