import { Module } from '@nestjs/common'

import { ServiceContractsController } from './service-contracts.controller'
import { ContractContextService } from './contract-context.service'
import { ServiceContractsService } from './service-contracts.service'

@Module({
  controllers: [ServiceContractsController],
  providers: [ServiceContractsService, ContractContextService],
  exports: [ServiceContractsService, ContractContextService],
})
export class ServiceContractsModule {}
