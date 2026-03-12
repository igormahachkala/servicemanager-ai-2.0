import { Module } from '@nestjs/common';
import { TechniciansService } from './technicians.service';
import { TechniciansController } from './technicians.controller';
import { TechniciansWorkloadService } from './technicians.workload.service';

@Module({
  providers: [TechniciansService, TechniciansWorkloadService],
  controllers: [TechniciansController],
})
export class TechniciansModule {}
