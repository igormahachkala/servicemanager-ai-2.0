import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/**
 * Web Push (mobile push notifications). См. docs/PUSH_NOTIFICATIONS_ARCHITECTURE_V1.md §4.
 * Экспортирует PushService, чтобы доменные модули могли слать пуши через sendToUser().
 */
@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
