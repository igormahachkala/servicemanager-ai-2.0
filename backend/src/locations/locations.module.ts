import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { ServiceContractsModule } from '../service-contracts/service-contracts.module';

@Module({
  imports: [ServiceContractsModule],
  providers: [LocationsService],
  controllers: [LocationsController],
})
export class LocationsModule {}
