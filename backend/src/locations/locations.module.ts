import { Module } from '@nestjs/common'
import { LocationsService } from './locations.service'
import { LocationsController } from './locations.controller'
import { ServiceContractsModule } from '../service-contracts/service-contracts.module'
import { DadataModule } from '../dadata/dadata.module'

@Module({
  imports: [ServiceContractsModule, DadataModule],
  providers: [LocationsService],
  controllers: [LocationsController],
  exports: [LocationsService],
})
export class LocationsModule {}
