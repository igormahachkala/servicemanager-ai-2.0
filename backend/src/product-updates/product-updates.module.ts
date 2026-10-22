import { Module } from '@nestjs/common';

import { ProductUpdatesController } from './product-updates.controller';
import { ProductUpdatesService } from './product-updates.service';

@Module({
  controllers: [ProductUpdatesController],
  providers: [ProductUpdatesService],
  exports: [ProductUpdatesService],
})
export class ProductUpdatesModule {}
