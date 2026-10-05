import { Module } from '@nestjs/common'

import { ServiceContractsModule } from '../service-contracts/service-contracts.module'
import { FailureCausesController } from './failure-causes.controller'
import { FailureCausesService } from './failure-causes.service'

@Module({
  imports: [ServiceContractsModule],
  controllers: [FailureCausesController],
  providers: [FailureCausesService],
  exports: [FailureCausesService],
})
export class FailureCausesModule {}
