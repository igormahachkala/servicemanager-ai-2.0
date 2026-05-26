import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TicketStatus, TicketUrgency } from '@prisma/client';

import { MaxBotSendMessageResponse, MaxBotUpdate, MaxBotUpdatesResponse } from './max-bot.types';

type PollParams = {
  limit?: number;
  timeout?: number;
  marker?: number | null;
  types?: string[];
};

type SendMessageParams = {
  chatId?: number | null;
  ticketId?: string | null;
  text?: string;
};

type TicketCreatedMessageParams = {
  ticketId: string;
  ticketNumber: number;
  requesterLabel?: string | null;
  requesterPhone?: string | null;
  description?: string | null;
  pointName?: string | null;
  address?: string | null;
  categoryName?: string | null;
  urgency?: TicketUrgency | string | null;
};

type TicketAssignedMessageParams = {
  ticketId: string;
  ticketNumber: number;
  technicianLabel?: string | null;
};

type TicketClaimedMessageParams = {
  ticketId: string;
  ticketNumber: number;
  technicianLabel?: string | null;
};

type TicketStatusChangedMessageParams = {
  ticketId: string;
  ticketNumber: number;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
};

@Injectable()
export class MaxBotService {
  private readonly logger = new Logger(MaxBotService.name);
  private readonly baseUrl = this.normalizeBaseUrl(process.env.MAX_BOT_API_BASE_URL || 'https://platform-api.max.ru');
  private readonly token = (process.env.MAX_BOT_API_TOKEN || '').trim();
  private readonly frontendUrl = this.resolveFrontendUrl();
  private readonly groupChatId = this.resolveGroupChatId();
  private lastChatId: number | null = null;
  private lastMarker: number | null = null;

  private normalizeBaseUrl(value: string) {
    return value.trim().replace(/\/+$/, '');
  }

  private resolveFrontendUrl() {
    const raw = (process.env.MAX_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || '').trim();
    if (!raw) return null;
    return raw.replace(/\/+$/, '');
  }

  private resolveGroupChatId() {
    const raw = (process.env.MAX_GROUP_CHAT_ID || '').trim();
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private ensureConfigured() {
    if (!this.token) {
      throw new InternalServerErrorException('MAX bot token is not configured');
    }
  }

  private buildFrontendLink(ticketId?: string | null) {
    if (!this.frontendUrl) {
      return null;
    }

    if (ticketId && ticketId.trim()) {
      return `${this.frontendUrl}/m/tickets/${encodeURIComponent(ticketId.trim())}`;
    }

    return this.frontendUrl;
  }

  private formatShortTicketLabel(ticketNumber: number, ticketId: string) {
    if (Number.isFinite(ticketNumber) && ticketNumber > 0) {
      return `#${ticketNumber}`;
    }
    return `#${ticketId.slice(0, 8).toUpperCase()}`;
  }

  private formatUrgencyLabel(urgency?: TicketUrgency | string | null) {
    if (!urgency) return null;
    if (urgency === TicketUrgency.URGENT) return 'Срочная';
    if (urgency === TicketUrgency.NOT_URGENT) return 'Не срочная';
    return String(urgency).trim() || null;
  }

  private formatStatusLabel(status: TicketStatus) {
    switch (status) {
      case TicketStatus.NEW:
        return 'Новая';
      case TicketStatus.ASSIGNED:
        return 'Назначена';
      case TicketStatus.IN_PROGRESS:
        return 'В работе';
      case TicketStatus.DONE:
        return 'Выполнена';
      case TicketStatus.CANCELED:
        return 'Отменена';
      default:
        return String(status);
    }
  }

  private clip(text: string, max = 1200) {
    const normalized = (text || '').trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max - 1)}…`;
  }

  private normalizeSingleLine(value?: string | null) {
    const normalized = (value || '').replace(/\s+/g, ' ').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeMultiline(value?: string | null, max = 650) {
    const normalized = (value || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!normalized) {
      return null;
    }

    if (normalized.length <= max) {
      return normalized;
    }

    return `${normalized.slice(0, max - 1)}…`;
  }

  private buildTicketLink(ticketId: string) {
    const frontendUrl = this.frontendUrl;
    return frontendUrl ? `${frontendUrl}/m/tickets/${encodeURIComponent(ticketId)}` : null;
  }

  private buildGroupMessage(payload: string) {
    const groupChatId = this.groupChatId;
    if (groupChatId === null) {
      this.logger.warn(
        {
          payload: payload.slice(0, 180),
        },
        'max_group_chat_id_missing',
      );
      return null;
    }
    return this.sendRawMessage(groupChatId, payload);
  }

  private async sendRawMessage(chatId: number, text: string) {
    const result = await this.requestJson<MaxBotSendMessageResponse>(
      `/messages?chat_id=${encodeURIComponent(String(chatId))}`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      },
    );

    this.logger.log({ chatId, text: text.slice(0, 220) }, 'max_bot_message_sent');

    return {
      chatId,
      text,
      ...result,
    };
  }

  private async sendOperationalMessage(text: string) {
    return this.buildGroupMessage(text);
  }

  async sendTicketCreatedMessage(params: TicketCreatedMessageParams) {
    const lines = ['🆕 Новая заявка'];
    lines.push(`Заявка: ${this.formatShortTicketLabel(params.ticketNumber, params.ticketId)}`);

    const requester = this.normalizeSingleLine(params.requesterLabel) || 'Не указан';
    const phone = this.normalizeSingleLine(params.requesterPhone) || 'Не указан';
    lines.push(`Отправитель: ${requester}`);
    lines.push(`Телефон: ${phone}`);

    const point = (params.pointName || '').trim() || (params.address || '').trim();
    if (point) {
      lines.push(`Точка: ${point}`);
    }
    if (params.categoryName?.trim()) {
      lines.push(`Категория: ${params.categoryName.trim()}`);
    }
    const urgency = this.formatUrgencyLabel(params.urgency);
    if (urgency) {
      lines.push(`Срочность: ${urgency}`);
    }

    lines.push('Комментарий:');
    const comment = this.normalizeMultiline(params.description) || 'Комментарий отсутствует';
    lines.push(`"${comment}"`);

    const link = this.buildTicketLink(params.ticketId);
    if (link) {
      lines.push(`Открыть:`);
      lines.push(link);
    }

    return this.sendOperationalMessage(this.clip(lines.join('\n')));
  }

  async sendTicketAssignedMessage(params: TicketAssignedMessageParams) {
    const lines = ['👷 Заявка назначена'];
    lines.push(`Заявка: ${this.formatShortTicketLabel(params.ticketNumber, params.ticketId)}`);
    const tech = (params.technicianLabel || '').trim();
    lines.push(`Исполнитель: ${tech || 'Исполнитель'}`);

    const link = this.buildTicketLink(params.ticketId);
    if (link) {
      lines.push(`Открыть: ${link}`);
    }

    return this.sendOperationalMessage(this.clip(lines.join('\n')));
  }

  async sendTicketClaimedMessage(params: TicketClaimedMessageParams) {
    const lines = ['🙋 Заявка взята в работу'];
    lines.push(`Заявка: ${this.formatShortTicketLabel(params.ticketNumber, params.ticketId)}`);
    const tech = (params.technicianLabel || '').trim();
    lines.push(`Исполнитель: ${tech || 'Исполнитель'}`);

    const link = this.buildTicketLink(params.ticketId);
    if (link) {
      lines.push(`Открыть: ${link}`);
    }

    return this.sendOperationalMessage(this.clip(lines.join('\n')));
  }

  async sendTicketStatusChangedMessage(params: TicketStatusChangedMessageParams) {
    const lines = ['🔄 Статус заявки изменён'];
    lines.push(`Заявка: ${this.formatShortTicketLabel(params.ticketNumber, params.ticketId)}`);
    lines.push(`Статус: ${this.formatStatusLabel(params.fromStatus)} → ${this.formatStatusLabel(params.toStatus)}`);

    const link = this.buildTicketLink(params.ticketId);
    if (link) {
      lines.push(`Открыть: ${link}`);
    }

    return this.sendOperationalMessage(this.clip(lines.join('\n')));
  }

  private composeTestMessage(params: SendMessageParams) {
    const link = this.buildFrontendLink(params.ticketId);
    const customText = (params.text || '').trim();

    if (!link) {
      this.logger.warn(
        {
          ticketId: params.ticketId ?? null,
        },
        'max_bot_frontend_url_missing',
      );
      return customText || 'Тестовое сообщение от ServiceManager.AI';
    }

    if (params.ticketId && params.ticketId.trim()) {
      return customText
        ? `${customText}\n${link}`
        : `✅ ServiceManager.AI MAX bot test: ${link}`;
    }

    if (customText) {
      return `${customText}\n${link}`;
    }

    return `✅ ServiceManager.AI MAX bot test: ${link}`;
  }

  private buildUrl(path: string, params?: URLSearchParams) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of params.entries()) {
        url.searchParams.append(key, value);
      }
    }
    return url.toString();
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    this.ensureConfigured();

    const headers = new Headers(init?.headers || {});
    headers.set('Authorization', this.token);

    if (init?.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(this.buildUrl(path), {
      ...init,
      headers,
    });

    const raw = await response.text();
    const text = raw.trim();

    if (!response.ok) {
      throw new BadRequestException({
        message: 'MAX API request failed',
        status: response.status,
        body: text.slice(0, 1000),
      });
    }

    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return { raw: text } as T;
    }
  }

  private parseChatId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private extractChatId(update: MaxBotUpdate): number | null {
    const candidates = [
      update.chat_id,
      (update as Record<string, unknown>).chatId,
      (update as Record<string, unknown>).message && typeof update.message === 'object'
        ? (update.message as Record<string, unknown>).chat_id
        : null,
      (update as Record<string, unknown>).chat && typeof update.chat === 'object'
        ? (update.chat as Record<string, unknown>).chat_id
        : null,
    ];

    for (const candidate of candidates) {
      const chatId = this.parseChatId(candidate);
      if (chatId !== null) {
        return chatId;
      }
    }

    return null;
  }

  private collectChatIds(updates: MaxBotUpdate[]) {
    const chatIds = new Set<number>();
    for (const update of updates) {
      const chatId = this.extractChatId(update);
      if (chatId !== null) {
        chatIds.add(chatId);
      }
    }
    return [...chatIds];
  }

  async pollUpdates(params: PollParams) {
    const query = new URLSearchParams();

    if (typeof params.limit === 'number') query.set('limit', String(params.limit));
    if (typeof params.timeout === 'number') query.set('timeout', String(params.timeout));
    if (typeof params.marker === 'number') query.set('marker', String(params.marker));
    if (params.types?.length) query.set('types', params.types.join(','));

    const result = await this.requestJson<MaxBotUpdatesResponse>(
      `/updates${query.toString() ? `?${query.toString()}` : ''}`,
    );

    const updates = Array.isArray(result.updates) ? result.updates : [];
    const chatIds = this.collectChatIds(updates);
    const lastChatId = chatIds.at(-1) ?? this.lastChatId;

    if (lastChatId !== null) {
      this.lastChatId = lastChatId;
    }

    if (typeof result.marker === 'number') {
      this.lastMarker = result.marker;
    }

    this.logger.log(
      {
        count: updates.length,
        chatIds,
        lastChatId: this.lastChatId,
        marker: result.marker ?? null,
      },
      'max_bot_updates_polled',
    );

    return {
      ...result,
      updates,
      chatIds,
      lastChatId: this.lastChatId,
      savedChatId: this.lastChatId,
      savedMarker: this.lastMarker,
    };
  }

  async sendTestMessage(params: SendMessageParams) {
    const chatId = params.chatId ?? this.lastChatId;
    if (chatId === null) {
      throw new BadRequestException('chatId is required. Poll updates first or pass chatId explicitly.');
    }

    const text = this.composeTestMessage(params);
    const frontendUrl = this.buildFrontendLink(params.ticketId);
    const result = await this.requestJson<MaxBotSendMessageResponse>(
      `/messages?chat_id=${encodeURIComponent(String(chatId))}`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      },
    );

    this.logger.log({ chatId, text }, 'max_bot_message_sent');

    return {
      chatId,
      lastChatId: this.lastChatId,
      frontendUrl,
      text,
      ...result,
    };
  }
}
