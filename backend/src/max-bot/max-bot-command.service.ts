import { Injectable, Logger } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MaxBotUpdate } from './max-bot.types';

const OPEN_STATUSES = [
  TicketStatus.NEW,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_ACCEPTANCE,
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.NEW]: 'Новая',
  [TicketStatus.ASSIGNED]: 'Назначена',
  [TicketStatus.IN_PROGRESS]: 'В работе',
  [TicketStatus.AWAITING_ACCEPTANCE]: 'На приёмке',
  [TicketStatus.DONE]: 'Выполнена',
  [TicketStatus.CANCELED]: 'Отменена',
};

@Injectable()
export class MaxBotCommandService {
  private readonly logger = new Logger(MaxBotCommandService.name);
  private readonly frontendUrl: string | null;

  constructor(private readonly prisma?: PrismaService) {
    const raw = (process.env.MAX_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || '').trim();
    this.frontendUrl = raw ? raw.replace(/\/+$/, '') : null;
  }

  async handleUpdate(update: MaxBotUpdate): Promise<string | null> {
    const extracted = this.extractMessageText(update);
    if (!extracted) {
      this.logger.log(
        {
          update_type: this.safeString(update.update_type),
          reason: 'missing_message_text',
        },
        'max_bot_command_ignored',
      );
      return null;
    }

    const trimmed = extracted.text.trim();
    if (!trimmed.startsWith('/')) {
      this.logger.log(
        {
          update_type: this.safeString(update.update_type),
          source: extracted.source,
          reason: 'not_a_command',
        },
        'max_bot_command_ignored',
      );
      return null;
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts[1];

    this.logger.log(
      {
        update_type: this.safeString(update.update_type),
        source: extracted.source,
        command: cmd,
        has_arg: !!arg,
      },
      'max_bot_command_parsed',
    );

    try {
      if (cmd === '/help') return this.handleParsedCommand(cmd, this.helpText());
      if (cmd === '/status') return this.handleParsedCommand(cmd, this.statusText());
      if (cmd === '/tickets') return this.handleParsedCommand(cmd, this.ticketListText());
      if (cmd === '/ticket') return this.handleParsedCommand(cmd, this.ticketDetailText(arg));
      if (cmd === '/open') return this.handleParsedCommand(cmd, this.ticketOpenText(arg));
    } catch (err) {
      this.logger.warn({ err, cmd }, 'max_bot_command_error');
      return '⚠️ Произошла ошибка при выполнении команды.';
    }

    this.logger.log(
      {
        update_type: this.safeString(update.update_type),
        source: extracted.source,
        command: cmd,
        reason: 'unknown_command',
      },
      'max_bot_command_ignored',
    );
    return null;
  }

  private handleParsedCommand(cmd: string, response: string | Promise<string>) {
    this.logger.log(
      {
        command: cmd,
      },
      'max_bot_command_handled',
    );
    return response;
  }

  private safeString(value: unknown) {
    return typeof value === 'string' ? value : null;
  }

  private extractMessageText(update: MaxBotUpdate): { text: string; source: string } | null {
    const message = update.message;
    if (message && typeof message === 'object') {
      const msg = message as Record<string, unknown>;
      if (typeof msg.text === 'string') return { text: msg.text, source: 'message.text' };
      if (typeof msg.body === 'string') return { text: msg.body, source: 'message.body' };
      // MAX webhook: message.body is an object { mid, seq, text }
      if (msg.body && typeof msg.body === 'object') {
        const bodyObj = msg.body as Record<string, unknown>;
        if (typeof bodyObj.text === 'string') return { text: bodyObj.text, source: 'message.body.text' };
      }
    }
    if (typeof update.text === 'string') return { text: update.text, source: 'update.text' };
    return null;
  }

  private helpText(): string {
    return [
      '📋 Доступные команды:',
      '/help — список команд',
      '/status — статус бота',
      '/tickets — открытые заявки (последние 5)',
      '/ticket <номер> — детали заявки',
      '/open <номер> — ссылка на заявку',
    ].join('\n');
  }

  private statusText(): string {
    const now = new Date().toISOString();
    const env = process.env.NODE_ENV || 'production';
    const mode = process.env.MAX_BOT_WEBHOOK_ENABLED === 'true' ? 'webhook' : 'polling'
    return `✅ Сервис Менеджер бот онлайн\nВремя: ${now}\nСреда: ${env}\nРежим: ${mode}`;
  }

  private async ticketListText(): Promise<string> {
    if (!this.prisma) return '⚠️ База данных недоступна.';

    const tickets = await this.prisma.ticket.findMany({
      where: { status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        problemText: true,
        location: { select: { name: true } },
      },
    });

    if (!tickets.length) return 'Открытых заявок нет.';

    const lines = ['📋 Открытые заявки:'];
    for (const t of tickets) {
      const shortText = (t.problemText || '').slice(0, 60).replace(/\n/g, ' ');
      lines.push(`#${t.ticketNumber} [${STATUS_LABELS[t.status]}] ${t.location?.name ?? '—'}: ${shortText}`);
    }
    return lines.join('\n');
  }

  private async ticketDetailText(arg?: string): Promise<string> {
    const n = this.parseTicketNumber(arg);
    if (n === null) return '⚠️ Укажите номер заявки: /ticket 123';
    if (!this.prisma) return '⚠️ База данных недоступна.';

    const t = await this.prisma.ticket.findUnique({
      where: { ticketNumber: n },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        problemText: true,
        requesterName: true,
        requesterPhone: true,
        location: { select: { name: true } },
        problemCategory: { select: { name: true } },
      },
    });

    if (!t) return `Заявка #${n} не найдена.`;

    const lines = [`🔎 Заявка #${t.ticketNumber}`];
    lines.push(`Статус: ${STATUS_LABELS[t.status]}`);
    if (t.location?.name) lines.push(`Точка: ${t.location.name}`);
    if (t.problemCategory?.name) lines.push(`Категория: ${t.problemCategory.name}`);
    if (t.requesterName) lines.push(`Заявитель: ${t.requesterName}`);
    if (t.requesterPhone) lines.push(`Телефон: ${t.requesterPhone}`);
    const shortText = (t.problemText || '').slice(0, 200);
    lines.push(`Описание: ${shortText}`);

    const link = this.buildTicketLink(t.id);
    if (link) lines.push(`Открыть: ${link}`);

    return lines.join('\n');
  }

  private async ticketOpenText(arg?: string): Promise<string> {
    const n = this.parseTicketNumber(arg);
    if (n === null) return '⚠️ Укажите номер заявки: /open 123';
    if (!this.prisma) return '⚠️ База данных недоступна.';

    const t = await this.prisma.ticket.findUnique({
      where: { ticketNumber: n },
      select: { id: true, ticketNumber: true },
    });

    if (!t) return `Заявка #${n} не найдена.`;

    const link = this.buildTicketLink(t.id);
    return link
      ? `🔗 Заявка #${t.ticketNumber}:\n${link}`
      : `Заявка #${t.ticketNumber} найдена, но ссылка не настроена.`;
  }

  private parseTicketNumber(arg?: string): number | null {
    if (!arg) return null;
    const n = parseInt(arg, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private buildTicketLink(ticketId: string): string | null {
    if (!this.frontendUrl) return null;
    return `${this.frontendUrl}/m/tickets/${encodeURIComponent(ticketId)}`;
  }
}
