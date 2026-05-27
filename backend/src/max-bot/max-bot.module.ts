import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { MaxBotController } from './max-bot.controller';
import { MaxBotService } from './max-bot.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaxBotController],
  providers: [MaxBotService],
  exports: [MaxBotService],
})
export class MaxBotModule {}
