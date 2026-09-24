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
    const message = update?.message && typeof update.message === 'object' ? (update.message as Record<string, unknown>) : null;
    const msgBody = message?.body && typeof message.body === 'object' ? (message.body as Record<string, unknown>) : null;
    const recipient = message?.recipient && typeof message.recipient === 'object' ? (message.recipient as Record<string, unknown>) : null;
    const msgChat = message?.chat && typeof message.chat === 'object' ? (message.chat as Record<string, unknown>) : null;
    const sender = message?.sender && typeof message.sender === 'object' ? (message.sender as Record<string, unknown>) : null;
    this.logger.log(
      {
        update_type: update?.update_type ?? null,
        top_level_keys: update ? Object.keys(update) : [],
        chat_id: update?.chat_id ?? null,
        has_message: !!message,
        message_keys: message ? Object.keys(message) : null,
        recipient_keys: recipient ? Object.keys(recipient) : null,
        body_keys: msgBody ? Object.keys(msgBody) : (typeof message?.body === 'string' ? 'string' : null),
        chat_keys: msgChat ? Object.keys(msgChat) : null,
        sender_keys: sender ? Object.keys(sender) : null,
        has_text:
          typeof update?.text === 'string' ||
          typeof message?.text === 'string' ||
          typeof message?.body === 'string' ||
          typeof msgBody?.text === 'string',
      },
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
