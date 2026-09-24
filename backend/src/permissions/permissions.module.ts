import { Module } from '@nestjs/common';

import { ServiceContractsModule } from '../service-contracts/service-contracts.module';

import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

/**
 * Permission catalog/matrix plus Access Constructor V1A backend operations.
 * Uses existing PermissionBlock/RolePermission/UserPermission/UserLocationBinding models.
 */
@Module({
  imports: [ServiceContractsModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
