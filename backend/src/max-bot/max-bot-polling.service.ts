import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { MaxBotService } from './max-bot.service';

@Injectable()
export class MaxBotPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaxBotPollingService.name);
  private readonly enabled: boolean;
  private readonly webhookEnabled: boolean;
  private readonly webhookUrl: string;
  private readonly webhookSecret: string;
  private readonly intervalMs: number;
  private readonly timeoutSeconds: number;
  private timer: NodeJS.Timeout | null = null;
  private marker: number | null = null;
  private running = false;

  constructor(private readonly maxBotService: MaxBotService) {
    this.enabled = process.env.MAX_BOT_COMMANDS_ENABLED === 'true';
    this.webhookEnabled = process.env.MAX_BOT_WEBHOOK_ENABLED === 'true';
    this.webhookUrl = (process.env.MAX_BOT_WEBHOOK_URL || '').trim();
    this.webhookSecret = (process.env.MAX_BOT_WEBHOOK_SECRET || '').trim();
    this.intervalMs = Math.max(1000, parseInt(process.env.MAX_BOT_POLL_INTERVAL_MS || '5000', 10) || 5000);
    this.timeoutSeconds = Math.max(0, parseInt(process.env.MAX_BOT_POLL_TIMEOUT_SECONDS || '5', 10) || 5);
  }

  onModuleInit() {
    if (!this.enabled) return;

    if (this.webhookEnabled) {
      this.logger.log('MAX bot running in webhook mode — polling disabled');
      if (this.webhookUrl) {
        this.maxBotService
          .registerWebhook({
            url: this.webhookUrl,
            secret: this.webhookSecret || undefined,
            updateTypes: ['message_created', 'message_callback'],
          })
          .then(() => {
            this.logger.log(`MAX bot webhook registered: ${this.webhookUrl}`);
          })
          .catch((err: unknown) => {
            this.logger.warn({ err }, 'max_bot_webhook_register_failed');
          });
      } else {
        this.logger.warn('MAX_BOT_WEBHOOK_URL is not set — webhook not registered');
      }
      return;
    }

    this.logger.log(`MAX bot polling started (interval=${this.intervalMs}ms, timeout=${this.timeoutSeconds}s)`);
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        this.logger.error('MAX bot poll tick unhandled error', err?.stack || String(err));
      });
    }, this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.log('MAX bot polling stopped');
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.maxBotService.pollUpdates({
        timeout: this.timeoutSeconds,
        marker: this.marker,
      });
      if (typeof result.savedMarker === 'number') {
        this.marker = result.savedMarker;
      }
    } catch (err) {
      this.logger.warn({ err }, 'max_bot_poll_failed');
    } finally {
      this.running = false;
    }
  }
}
