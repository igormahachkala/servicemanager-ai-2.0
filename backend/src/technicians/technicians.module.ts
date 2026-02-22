import { Module } from '@nestjs/common';
import { TechniciansService } from './technicians.service';
import { TechniciansController } from './technicians.controller';

@Module({
  providers: [TechniciansService],
  controllers: [TechniciansController],
})
export class TechniciansModule {}
