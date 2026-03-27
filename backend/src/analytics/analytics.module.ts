import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { TimelineModule } from '../timeline/timeline.module'
import { ServiceContractsModule } from '../service-contracts/service-contracts.module'

@Module({
  imports: [PrismaModule, TimelineModule, ServiceContractsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
