import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { MaxBotCommandService } from './max-bot-command.service';
import { MaxBindingController } from './max-binding.controller';
import { MaxBindingService } from './max-binding.service';
import { MaxIdentityService } from './max-identity.service';
import { MaxBotController } from './max-bot.controller';
import { MaxBotPollingService } from './max-bot-polling.service';
import { MaxBotWebhookController } from './max-bot-webhook.controller';
import { MaxBotService } from './max-bot.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaxBotController, MaxBotWebhookController, MaxBindingController],
  providers: [
    MaxBotService,
    MaxBotCommandService,
    MaxBotPollingService,
    MaxIdentityService,
    MaxBindingService,
  ],
  // MaxIdentityService is the single bot-facing identity contract (`resolveMaxIdentity`).
  // MaxBindingService is exported for the ceremony only — nothing resolves authority here.
  exports: [MaxBotService, MaxIdentityService, MaxBindingService],
})
export class MaxBotModule {}
