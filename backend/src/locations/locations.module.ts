import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { ServiceContractsModule } from '../service-contracts/service-contracts.module';
import { TwogisModule } from '../twogis/twogis.module';

@Module({
  imports: [ServiceContractsModule, TwogisModule],
  providers: [LocationsService],
  controllers: [LocationsController],
})
export class LocationsModule {}
