import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { MaxBotCommandService } from './max-bot-command.service';
import { MaxBotController } from './max-bot.controller';
import { MaxBotPollingService } from './max-bot-polling.service';
import { MaxBotService } from './max-bot.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaxBotController],
  providers: [MaxBotService, MaxBotCommandService, MaxBotPollingService],
  exports: [MaxBotService],
})
export class MaxBotModule {}
