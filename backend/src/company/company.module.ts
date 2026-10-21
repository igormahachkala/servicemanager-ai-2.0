import { Module } from '@nestjs/common'

import { ServiceContractsModule } from '../service-contracts/service-contracts.module'
import { CompanyService } from './company.service'
import { CompanyController } from './company.controller'

@Module({
  imports: [ServiceContractsModule],
  providers: [CompanyService],
  controllers: [CompanyController],
})
export class CompanyModule {}