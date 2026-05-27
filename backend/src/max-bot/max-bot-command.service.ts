import { Injectable, Logger } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MaxBotUpdate } from './max-bot.types';

const OPEN_STATUSES = [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS];

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.NEW]: 'Новая',
  [TicketStatus.ASSIGNED]: 'Назначена',
  [TicketStatus.IN_PROGRESS]: 'В работе',
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
    const text = this.extractMessageText(update);
    if (!text) return null;
    const trimmed = text.trim();
    if (!trimmed.startsWith('/')) return null;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts[1];

    try {
      if (cmd === '/help') return this.helpText();
      if (cmd === '/status') return this.statusText();
      if (cmd === '/tickets') return this.ticketListText();
      if (cmd === '/ticket') return this.ticketDetailText(arg);
      if (cmd === '/open') return this.ticketOpenText(arg);
    } catch (err) {
      this.logger.warn({ err, cmd }, 'max_bot_command_error');
      return '⚠️ Произошла ошибка при выполнении команды.';
    }

    return null;
  }

  private extractMessageText(update: MaxBotUpdate): string | null {
    const message = update.message;
    if (message && typeof message === 'object') {
      const msg = message as Record<string, unknown>;
      if (typeof msg.text === 'string') return msg.text;
      if (typeof msg.body === 'string') return msg.body;
    }
    if (typeof update.text === 'string') return update.text;
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
    return `✅ ServiceManager.AI бот онлайн\nВремя: ${now}\nСреда: ${env}`;
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
