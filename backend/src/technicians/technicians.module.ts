import { Module } from '@nestjs/common'
import { TechniciansService } from './technicians.service'
import { TechniciansController } from './technicians.controller'
import { TechniciansWorkloadService } from './technicians.workload.service'
import { ServiceContractsModule } from '../service-contracts/service-contracts.module'

@Module({
  imports: [ServiceContractsModule],
  providers: [TechniciansService, TechniciansWorkloadService],
  controllers: [TechniciansController],
  exports: [TechniciansService],
})
export class TechniciansModule {}