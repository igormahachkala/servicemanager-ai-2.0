import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MaxBotModule } from '../max-bot/max-bot.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, MaxBotModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
