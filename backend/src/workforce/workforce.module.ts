import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { ServiceContractsModule } from '../service-contracts/service-contracts.module'
import { WorkforceAutoCloseService } from './workforce-auto-close.service'
import { WorkforceController } from './workforce.controller'
import { WorkforceService } from './workforce.service'

@Module({
  imports: [PrismaModule, ServiceContractsModule],
  controllers: [WorkforceController],
  providers: [WorkforceService, WorkforceAutoCloseService],
  exports: [WorkforceService],
})
export class WorkforceModule {}
