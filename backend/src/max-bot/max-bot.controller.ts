import { BadRequestException, Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import { MaxBotService } from './max-bot.service';

function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toTypes(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    const items = value.flatMap((entry) =>
      String(entry)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    );
    return items.length ? items : undefined;
  }
  const items = String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
@Controller('max-bot')
export class MaxBotController {
  constructor(private readonly maxBot: MaxBotService) {}

  @Get('test/updates')
  pollUpdates(@Query() query: Record<string, unknown>) {
    return this.maxBot.pollUpdates({
      limit: toInt(query.limit),
      timeout: toInt(query.timeout),
      marker: toInt(query.marker) ?? null,
      types: toTypes(query.types),
    });
  }

  @Post('test/send-message')
  sendMessage(@Body() body: { chatId?: number; ticketId?: string; text?: string }) {
    return this.maxBot.sendTestMessage({
      chatId: typeof body.chatId === 'number' ? body.chatId : toInt(body.chatId),
      ticketId: typeof body.ticketId === 'string' ? body.ticketId : undefined,
      text: body.text,
    });
  }

  @Get('subscriptions')
  getSubscriptions() {
    return this.maxBot.getSubscriptions();
  }

  @Post('subscriptions/register')
  registerWebhook(@Body() body: { url?: string; secret?: string; updateTypes?: string[] }) {
    const url = (body.url || process.env.MAX_BOT_WEBHOOK_URL || '').trim();
    if (!url) throw new BadRequestException('url is required (or set MAX_BOT_WEBHOOK_URL)');
    return this.maxBot.registerWebhook({
      url,
      secret: body.secret || process.env.MAX_BOT_WEBHOOK_SECRET || undefined,
      updateTypes: body.updateTypes,
    });
  }

  @Post('commands/minimal')
  registerMinimalCommandMenu() {
    return this.maxBot.registerMinimalCommandMenu();
  }

  @Delete('subscriptions')
  deleteSubscriptions() {
    return this.maxBot.deleteSubscriptions();
  }
}
