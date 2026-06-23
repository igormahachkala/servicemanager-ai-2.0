import { Module } from '@nestjs/common'

import { ServiceContractsModule } from '../service-contracts/service-contracts.module'

import { PermissionsController } from './permissions.controller'
import { PermissionsService } from './permissions.service'

@Module({
  imports: [ServiceContractsModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
