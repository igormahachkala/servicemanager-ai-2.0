import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsContextGuard } from '../common/permissions-context.guard';

import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { EquipmentRepository } from './equipment.repository';

@Module({
  imports: [PrismaModule],
  controllers: [EquipmentController],
  providers: [EquipmentService, EquipmentRepository, PermissionsContextGuard],
})
export class EquipmentModule {}