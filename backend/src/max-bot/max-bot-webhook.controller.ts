import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';

import { MaxBotService } from './max-bot.service';
import { MaxBotUpdate } from './max-bot.types';

@Controller('max-bot')
export class MaxBotWebhookController {
  private readonly logger = new Logger(MaxBotWebhookController.name);
  private readonly secret = (process.env.MAX_BOT_WEBHOOK_SECRET || '').trim();

  constructor(private readonly maxBotService: MaxBotService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() body: unknown,
    @Headers('x-max-bot-api-secret') incomingSecret?: string,
  ) {
    if (this.secret && incomingSecret !== this.secret) {
      this.logger.warn({ hint: (incomingSecret || '').slice(0, 8) }, 'max_bot_webhook_secret_mismatch');
      return { ok: false };
    }

    const update = body as MaxBotUpdate;
    this.logger.log(
      { update_type: update?.update_type ?? null, chat_id: update?.chat_id ?? null },
      'max_bot_webhook_received',
    );

    try {
      await this.maxBotService.handleWebhookUpdate(update);
    } catch (err) {
      this.logger.warn({ err }, 'max_bot_webhook_handle_failed');
    }

    return { ok: true };
  }
}
