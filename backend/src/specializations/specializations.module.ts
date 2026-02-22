import { Module } from '@nestjs/common';
import { SpecializationsService } from './specializations.service';
import { SpecializationsController } from './specializations.controller';

@Module({
  providers: [SpecializationsService],
  controllers: [SpecializationsController],
})
export class SpecializationsModule {}
