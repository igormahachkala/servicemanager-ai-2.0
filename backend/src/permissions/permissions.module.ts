import { Module } from '@nestjs/common';

import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

/**
 * Read-only permission catalog/matrix API.
 * Фундамент для будущего UI-конструктора ролей. Без мутаций, без зависимостей от БД.
 */
@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
