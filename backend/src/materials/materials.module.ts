import { Module } from '@nestjs/common';

import { PermissionsContextGuard } from '../common/permissions-context.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceContractsModule } from '../service-contracts/service-contracts.module';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [PrismaModule, ServiceContractsModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, PermissionsContextGuard],
})
export class MaterialsModule {}
