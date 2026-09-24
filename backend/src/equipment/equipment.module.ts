import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { ServiceContractsModule } from '../service-contracts/service-contracts.module';

import { EquipmentController } from './equipment.controller';
import { PartDefinitionsController } from './part-definitions.controller';
import { EquipmentService } from './equipment.service';
import { EquipmentHistoryService } from './equipment-history.service';
import { EquipmentPartsService } from './equipment-parts.service';
import { EquipmentRepository } from './equipment.repository';

@Module({
  imports: [PrismaModule, ServiceContractsModule],
  controllers: [EquipmentController, PartDefinitionsController],
  providers: [
    EquipmentService,
    EquipmentHistoryService,
    EquipmentPartsService,
    EquipmentRepository,
    PermissionsContextGuard,
  ],
})
export class EquipmentModule {}
