import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MaxBotModule } from '../max-bot/max-bot.module';
import { PushModule } from '../push/push.module';
import { ServiceContractsModule } from '../service-contracts/service-contracts.module';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, MaxBotModule, PushModule, ServiceContractsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationPreferencesService],
  exports: [NotificationsService, NotificationPreferencesService],
})
export class NotificationsModule {}
