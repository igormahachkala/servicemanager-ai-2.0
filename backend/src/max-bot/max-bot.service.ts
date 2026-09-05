import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { TicketStatus, TicketUrgency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

import { MaxBotCommandService } from './max-bot-command.service';
import { extractMaxUserId } from './max-identity.service';
import {
  buildMinimalMaxBotCommands,
  normalizeMaxBotUsername,
  renderOpenAppMessage,
  renderTicketNavigationMessage,
  type MaxTicketNotificationButtonKind,
} from './max-menu.builder';
import { getMaxBotRuntimeDiagnostics, type MaxBotRuntimeDiagnostics } from './max-bot-runtime';
import {
  MAX_BOT_COMMAND_UPDATE_TYPES,
  type MaxBotCommandResponse,
  type MaxBotMessageBody,
  MaxBotSendMessageResponse,
  MaxBotUpdate,
  MaxBotUpdatesResponse,
} from './max-bot.types';

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
  companyId: string;
  locationId?: string | null;
  locationName?: string | null;
  /** Готовая строка «<Город> · <Точка>» из notification-location-context. Канал её не пересобирает. */
  locationContext?: string | null;
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
  companyId: string;
  locationId?: string | null;
  locationName?: string | null;
  /** Готовая строка «<Город> · <Точка>» из notification-location-context. Канал её не пересобирает. */
  locationContext?: string | null;
  ticketId: string;
  ticketNumber: number;
  technicianLabel?: string | null;
};

type TicketClaimedMessageParams = {
  companyId: string;
  locationId?: string | null;
  locationName?: string | null;
  /** Готовая строка «<Город> · <Точка>» из notification-location-context. Канал её не пересобирает. */
  locationContext?: string | null;
  ticketId: string;
  ticketNumber: number;
  technicianLabel?: string | null;
};

type TicketStatusChangedMessageParams = {
  companyId: string;
  locationId?: string | null;
  locationName?: string | null;
  /** Готовая строка «<Город> · <Точка>» из notification-location-context. Канал её не пересобирает. */
  locationContext?: string | null;
  ticketId: string;
  ticketNumber: number;
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
};

type LocationAnchor = {
  id: string;
  companyId: string;
  locationId: string;
  chatId: bigint;
  anchorMessageId: string;
  anchorMessageCreatedAt: Date | null;
};

type MaxBotTokenValidation = {
  required: boolean;
  ok: boolean;
  status: number | null;
  statusText: string | null;
  path: string;
  reason: string | null;
};

type CommandChatDecision = {
  allowed: boolean;
  scope: 'configured_group' | 'private' | 'other_group' | 'unknown';
  reason?: 'other_group_chat' | 'untrusted_chat';
};

const PRIVATE_MAX_CHAT_TYPES = new Set(['dialog', 'private', 'direct', 'user']);
const GROUP_MAX_CHAT_TYPES = new Set(['chat', 'group', 'supergroup', 'channel']);

@Injectable()
export class MaxBotService implements OnModuleInit {
  private readonly logger = new Logger(MaxBotService.name);
  private readonly baseUrl = this.normalizeBaseUrl(process.env.MAX_BOT_API_BASE_URL || 'https://platform-api2.max.ru');
  private readonly token = (process.env.MAX_BOT_API_TOKEN || '').trim();
  private readonly frontendUrl = this.resolveFrontendUrl();
  private readonly botUsername = normalizeMaxBotUsername(process.env.MAX_BOT_USERNAME);
  private readonly groupChatId = this.resolveGroupChatId();
  private readonly runtimeDiagnostics: MaxBotRuntimeDiagnostics = getMaxBotRuntimeDiagnostics();
  private readonly locationAnchorLocks = new Map<string, Promise<LocationAnchor | null>>();
  private lastChatId: number | null = null;
  private lastMarker: number | null = null;

  constructor(
    private readonly prisma?: PrismaService,
    private readonly commandService?: MaxBotCommandService,
  ) {}

  onModuleInit() {
    this.logRuntimeDiagnostics('service_init');
  }

  getRuntimeDiagnostics() {
    return this.runtimeDiagnostics;
  }

  private async validateTokenConnectivity(): Promise<MaxBotTokenValidation> {
    const required = this.runtimeDiagnostics.commandsEnabled || this.runtimeDiagnostics.webhookEnabled;
    const path = '/subscriptions?limit=1';
    if (!required) {
      return {
        required: false,
        ok: true,
        status: null,
        statusText: null,
        path,
        reason: null,
      };
    }
    if (!this.token) {
      return {
        required: true,
        ok: false,
        status: null,
        statusText: null,
        path,
        reason: 'missing_token',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Authorization: this.token,
        },
      });

      if (response.ok) {
        return {
          required: true,
          ok: true,
          status: response.status,
          statusText: response.statusText,
          path,
          reason: null,
        };
      }

      const body = this.clip(await response.text(), 240);
      return {
        required: true,
        ok: false,
        status: response.status,
        statusText: response.statusText,
        path,
        reason: body || 'request_failed',
      };
    } catch (err) {
      return {
        required: true,
        ok: false,
        status: null,
        statusText: null,
        path,
        reason: err instanceof Error ? err.message : 'request_failed',
      };
    }
  }

  async getHealthDiagnostics() {
    const tokenValidation = await this.validateTokenConnectivity();
    const status =
      this.runtimeDiagnostics.status === 'ok' && tokenValidation.ok ? 'ok' : 'degraded';
    return {
      status,
      diagnostics: this.runtimeDiagnostics,
      tokenValidation,
    };
  }

  logRuntimeDiagnostics(context: string = 'startup') {
    this.logger.log(
      {
        context,
        ...this.runtimeDiagnostics,
      },
      'max_bot_env_diagnostics',
    );
    if (this.runtimeDiagnostics.issues.length > 0) {
      this.logger.warn(
        {
          context,
          issues: this.runtimeDiagnostics.issues,
        },
        'max_bot_env_validation_warn',
      );
    }
  }

  private normalizeBaseUrl(value: string) {
    const normalized = value.trim().replace(/\/+$/, '');
    return normalized === 'https://platform-api.max.ru'
      ? 'https://platform-api2.max.ru'
      : normalized;
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
      this.logger.warn(
        {
          ...this.runtimeDiagnostics,
        },
        'max_bot_token_missing',
      );
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
      case TicketStatus.AWAITING_ACCEPTANCE:
        return 'На приёмке';
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

  /**
   * Строка локации в сообщении: канонический контекст «<Город> · <Точка>»,
   * посчитанный в notifications, иначе имя точки. Своего формата у канала нет.
   */
  private formatLocationLine(params: {
    locationContext?: string | null;
    pointName?: string | null;
    locationName?: string | null;
  }) {
    return (
      this.normalizeSingleLine(params.locationContext) ||
      this.normalizeSingleLine(params.pointName) ||
      this.normalizeSingleLine(params.locationName) ||
      ''
    );
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

  private ticketNavigationMessage(
    text: string,
    ticketId: string,
    kind: MaxTicketNotificationButtonKind,
  ): MaxBotMessageBody {
    return renderTicketNavigationMessage({
      text,
      botUsername: this.botUsername,
      ticketId,
      kind,
    });
  }

  private buildGroupMessage(payload: string | MaxBotMessageBody) {
    const groupChatId = this.groupChatId;
    if (groupChatId === null) {
      const text = typeof payload === 'string' ? payload : payload.text || '';
      this.logger.warn(
        {
          payload: text.slice(0, 180),
        },
        'max_group_chat_id_missing',
      );
      return null;
    }
    return this.sendRawMessage(groupChatId, payload);
  }

  private extractMessageId(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const root = payload as Record<string, unknown>;
    const message = root.message && typeof root.message === 'object' ? (root.message as Record<string, unknown>) : null;
    const candidates = [
      message?.mid,
      message?.message_id,
      message?.messageId,
      message?.id,
      root.mid,
      root.message_id,
      root.messageId,
      root.id,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
      if (typeof candidate === 'bigint') return candidate.toString();
    }
    return null;
  }

  private parseReplyMessageId(messageId: string) {
    const numeric = Number(messageId);
    if (Number.isFinite(numeric) && String(Math.trunc(numeric)) === messageId.trim()) {
      return { reply_to_message_id: messageId, reply_to_mid: Math.trunc(numeric) };
    }
    return { reply_to_message_id: messageId };
  }

  private normalizeMessageBody(message: string | MaxBotMessageBody): MaxBotMessageBody {
    return typeof message === 'string' ? { text: message } : message;
  }

  private async sendRawMessage(chatId: number, message: string | MaxBotMessageBody, replyToMessageId?: string | null) {
    const body: Record<string, unknown> = { ...this.normalizeMessageBody(message) };
    if (replyToMessageId) {
      Object.assign(body, this.parseReplyMessageId(replyToMessageId));
    }

    const result = await this.requestJson<MaxBotSendMessageResponse>(
      `/messages?chat_id=${encodeURIComponent(String(chatId))}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );

    const messageId = this.extractMessageId(result);
    const text = typeof body.text === 'string' ? body.text : '';
    this.logger.log(
      {
        chatId,
        text: text.slice(0, 220),
        attachments: Array.isArray(body.attachments) ? body.attachments.length : 0,
      },
      'max_bot_message_sent',
    );

    return {
      chatId,
      text,
      attachments: body.attachments,
      messageId,
      ...result,
    };
  }

  private async findLocationAnchorRecord(companyId: string, locationId: string): Promise<LocationAnchor | null> {
    if (!this.prisma || this.groupChatId === null) return null;
    return this.prisma.maxLocationThread.findUnique({
      where: {
        locationId_chatId: {
          locationId,
          chatId: BigInt(this.groupChatId),
        },
      },
    });
  }

  private async loadLocationName(companyId: string, locationId: string, fallback?: string | null) {
    const fallbackName = this.normalizeSingleLine(fallback);
    if (!this.prisma) return fallbackName || 'Локация';
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        clientCompanyId: companyId,
        isActive: true,
      },
      select: { name: true },
    });
    return this.normalizeSingleLine(location?.name) || fallbackName || 'Локация';
  }

  async getOrCreateLocationAnchor(params: {
    companyId: string;
    locationId: string;
    locationName?: string | null;
  }): Promise<LocationAnchor | null> {
    const prisma = this.prisma;
    const groupChatId = this.groupChatId;
    if (!prisma || groupChatId === null) return null;
    const lockKey = `${params.companyId}:${params.locationId}:${groupChatId}`;
    const existingLock = this.locationAnchorLocks.get(lockKey);
    if (existingLock) return existingLock;

    const task = (async () => {
      const existing = await this.findLocationAnchorRecord(params.companyId, params.locationId);
      if (existing?.anchorMessageId) {
        return existing;
      }

      const locationName = await this.loadLocationName(params.companyId, params.locationId, params.locationName);
      const sent = await this.sendRawMessage(groupChatId, `🏪 ${locationName}`);
      const anchorMessageId = sent.messageId;
      if (!anchorMessageId) {
        this.logger.warn(
          { companyId: params.companyId, locationId: params.locationId, chatId: groupChatId },
          'max_location_anchor_message_id_missing',
        );
        return null;
      }

      const createdAt = new Date();
      const data = {
        companyId: params.companyId,
        locationId: params.locationId,
        chatId: BigInt(groupChatId),
        anchorMessageId,
        anchorMessageCreatedAt: createdAt,
      };

      if (existing) {
        return prisma.maxLocationThread.update({
          where: {
            locationId_chatId: {
              locationId: params.locationId,
              chatId: BigInt(groupChatId),
            },
          },
          data,
        });
      }

      try {
        return await prisma.maxLocationThread.create({ data });
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          return prisma.maxLocationThread.findUnique({
            where: {
              locationId_chatId: {
                locationId: params.locationId,
                chatId: BigInt(groupChatId),
              },
            },
          });
        }
        throw err;
      }
    })();

    this.locationAnchorLocks.set(lockKey, task);
    try {
      return await task;
    } finally {
      if (this.locationAnchorLocks.get(lockKey) === task) {
        this.locationAnchorLocks.delete(lockKey);
      }
    }
  }

  async sendLocationReplyNotification(params: {
    companyId: string;
    locationId?: string | null;
    locationName?: string | null;
    message: string | MaxBotMessageBody;
  }) {
    if (!params.locationId?.trim()) {
      return this.sendOperationalMessage(params.message);
    }
    const anchor = await this.getOrCreateLocationAnchor({
      companyId: params.companyId,
      locationId: params.locationId.trim(),
      locationName: params.locationName,
    });
    if (!anchor?.anchorMessageId) {
      return this.sendOperationalMessage(params.message);
    }
    try {
      return await this.sendRawMessage(this.groupChatId!, params.message, anchor.anchorMessageId);
    } catch (err) {
      this.logger.warn(
        {
          err,
          companyId: params.companyId,
          locationId: params.locationId,
          anchorMessageId: anchor.anchorMessageId,
        },
        'max_location_reply_failed_fallback_to_group',
      );
      return this.sendOperationalMessage(params.message);
    }
  }

  private async sendOperationalMessage(message: string | MaxBotMessageBody) {
    return this.buildGroupMessage(message);
  }

  async sendTicketCreatedMessage(params: TicketCreatedMessageParams) {
    const lines = ['🆕 Новая заявка'];
    lines.push(`Заявка: ${this.formatShortTicketLabel(params.ticketNumber, params.ticketId)}`);

    const requester = this.normalizeSingleLine(params.requesterLabel) || 'Не указан';
    const phone = this.normalizeSingleLine(params.requesterPhone) || 'Не указан';
    lines.push(`Отправитель: ${requester}`);
    lines.push(`Телефон: ${phone}`);

    const point = this.formatLocationLine(params) || (params.address || '').trim();
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

    const message = this.ticketNavigationMessage(this.clip(lines.join('\n')), params.ticketId, 'ticket');

    return this.sendLocationReplyNotification({
      companyId: params.companyId,
      locationId: params.locationId,
      locationName: params.locationName,
      message,
    });
  }

  async sendTicketAssignedMessage(params: TicketAssignedMessageParams) {
    const lines = ['👷 Заявка назначена'];
    lines.push(`Заявка: ${this.formatShortTicketLabel(params.ticketNumber, params.ticketId)}`);
    const point = this.formatLocationLine(params);
    if (point) {
      lines.push(`Точка: ${point}`);
    }
    const tech = (params.technicianLabel || '').trim();
    lines.push(`Исполнитель: ${tech || 'Исполнитель'}`);

    const message = this.ticketNavigationMessage(this.clip(lines.join('\n')), params.ticketId, 'assignment');

    return this.sendLocationReplyNotification({
      companyId: params.companyId,
      locationId: params.locationId,
      locationName: params.locationName,
      message,
    });
  }

  async sendTicketClaimedMessage(params: TicketClaimedMessageParams) {
    const lines = ['🙋 Заявка взята в работу'];
    lines.push(`Заявка: ${this.formatShortTicketLabel(params.ticketNumber, params.ticketId)}`);
    const point = this.formatLocationLine(params);
    if (point) {
      lines.push(`Точка: ${point}`);
    }
    const tech = (params.technicianLabel || '').trim();
    lines.push(`Исполнитель: ${tech || 'Исполнитель'}`);

    const message = this.ticketNavigationMessage(this.clip(lines.join('\n')), params.ticketId, 'ticket');

    return this.sendLocationReplyNotification({
      companyId: params.companyId,
      locationId: params.locationId,
      locationName: params.locationName,
      message,
    });
  }

  async sendTicketStatusChangedMessage(params: TicketStatusChangedMessageParams) {
    const lines = ['🔄 Статус заявки изменён'];
    lines.push(`Заявка: ${this.formatShortTicketLabel(params.ticketNumber, params.ticketId)}`);
    const point = this.formatLocationLine(params);
    if (point) {
      lines.push(`Точка: ${point}`);
    }
    lines.push(`Статус: ${this.formatStatusLabel(params.fromStatus)} → ${this.formatStatusLabel(params.toStatus)}`);

    const buttonKind: MaxTicketNotificationButtonKind =
      params.toStatus === TicketStatus.AWAITING_ACCEPTANCE ? 'acceptance' : 'ticket';
    const message = this.ticketNavigationMessage(this.clip(lines.join('\n')), params.ticketId, buttonKind);

    return this.sendLocationReplyNotification({
      companyId: params.companyId,
      locationId: params.locationId,
      locationName: params.locationName,
      message,
    });
  }

  private composeTestMessage(params: SendMessageParams): MaxBotMessageBody {
    const link = this.buildFrontendLink(params.ticketId);
    const customText = (params.text || '').trim();

    if (!link) {
      this.logger.warn(
        {
          ticketId: params.ticketId ?? null,
        },
        'max_bot_frontend_url_missing',
      );
      return { text: customText || 'Тестовое сообщение от Сервис Менеджер' };
    }

    if (params.ticketId && params.ticketId.trim()) {
      return this.ticketNavigationMessage(
        customText || 'Сервис Менеджер MAX bot test',
        params.ticketId,
        'ticket',
      );
    }

    if (customText) {
      return { text: customText };
    }

    return renderOpenAppMessage('Сервис Менеджер MAX bot test', this.botUsername);
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
      const safeBody = text.slice(0, 500);
      this.logger.warn(
        {
          status: response.status,
          statusText: response.statusText,
          path,
          body: safeBody,
        },
        'max_api_request_failed',
      );
      throw new BadRequestException({
        message: 'MAX API request failed',
        status: response.status,
        body: safeBody,
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

  private isUniqueViolation(err: unknown) {
    return (
      !!err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
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
    const msg = update.message && typeof update.message === 'object'
      ? (update.message as Record<string, unknown>) : null;
    const topChat = update.chat && typeof update.chat === 'object'
      ? (update.chat as Record<string, unknown>) : null;
    const topRecipient = update.recipient && typeof update.recipient === 'object'
      ? (update.recipient as Record<string, unknown>) : null;
    const msgRecipient = msg?.recipient && typeof msg.recipient === 'object'
      ? (msg.recipient as Record<string, unknown>) : null;
    const msgChat = msg?.chat && typeof msg.chat === 'object'
      ? (msg.chat as Record<string, unknown>) : null;
    const callback = update.callback && typeof update.callback === 'object'
      ? (update.callback as Record<string, unknown>) : null;
    const callbackChat = callback?.chat && typeof callback.chat === 'object'
      ? (callback.chat as Record<string, unknown>) : null;
    const callbackRecipient = callback?.recipient && typeof callback.recipient === 'object'
      ? (callback.recipient as Record<string, unknown>) : null;
    const callbackMessage = callback?.message && typeof callback.message === 'object'
      ? (callback.message as Record<string, unknown>) : null;
    const callbackMessageRecipient = callbackMessage?.recipient && typeof callbackMessage.recipient === 'object'
      ? (callbackMessage.recipient as Record<string, unknown>) : null;
    const callbackMessageChat = callbackMessage?.chat && typeof callbackMessage.chat === 'object'
      ? (callbackMessage.chat as Record<string, unknown>) : null;

    const candidates = [
      // top-level flat fields (polling responses)
      update.chat_id,
      update.chatId,
      update.dialog_id,
      callback?.chat_id,
      callback?.chatId,
      callback?.dialog_id,
      // top-level nested objects
      topChat?.chat_id,
      topChat?.id,
      topRecipient?.chat_id,
      topRecipient?.chatId,
      callbackChat?.chat_id,
      callbackChat?.id,
      callbackRecipient?.chat_id,
      callbackRecipient?.chatId,
      // message-level fields (webhook: message.chat_id or message.dialog_id)
      msg?.chat_id,
      msg?.dialog_id,
      callbackMessage?.chat_id,
      callbackMessage?.dialog_id,
      // message.recipient.chat_id — actual MAX webhook structure
      msgRecipient?.chat_id,
      msgRecipient?.chatId,
      callbackMessageRecipient?.chat_id,
      callbackMessageRecipient?.chatId,
      // message.chat.id — alternative nested shape
      msgChat?.chat_id,
      msgChat?.id,
      callbackMessageChat?.chat_id,
      callbackMessageChat?.id,
    ];

    for (const candidate of candidates) {
      const chatId = this.parseChatId(candidate);
      if (chatId !== null) {
        return chatId;
      }
    }

    if (update.update_type === 'bot_started') {
      return this.parseChatId(extractMaxUserId(update));
    }

    return null;
  }

  private classifyCommandChat(
    update: MaxBotUpdate,
    chatId: number,
    chatType: string | null,
    groupChatId: number | null,
  ): CommandChatDecision {
    if (groupChatId !== null && chatId === groupChatId) {
      return { allowed: true, scope: 'configured_group' };
    }

    if (chatType && PRIVATE_MAX_CHAT_TYPES.has(chatType)) {
      return { allowed: true, scope: 'private' };
    }

    if (chatType && GROUP_MAX_CHAT_TYPES.has(chatType)) {
      return { allowed: false, scope: 'other_group', reason: 'other_group_chat' };
    }

    if (this.looksLikePrivateDialog(update, chatId)) {
      return { allowed: true, scope: 'private' };
    }

    return { allowed: false, scope: 'unknown', reason: 'untrusted_chat' };
  }

  private looksLikePrivateDialog(update: MaxBotUpdate, chatId: number) {
    const maxUserId = extractMaxUserId(update);
    if (!maxUserId) return false;
    if (update.update_type === 'bot_started') return true;
    return chatId > 0;
  }

  private extractChatType(update: MaxBotUpdate): string | null {
    const msg = this.readRecord(update.message);
    const topChat = this.readRecord(update.chat);
    const topRecipient = this.readRecord(update.recipient);
    const msgRecipient = this.readRecord(msg?.recipient);
    const msgChat = this.readRecord(msg?.chat);
    const callback = this.readRecord(update.callback);
    const callbackChat = this.readRecord(callback?.chat);
    const callbackRecipient = this.readRecord(callback?.recipient);
    const callbackMessage = this.readRecord(callback?.message);
    const callbackMessageRecipient = this.readRecord(callbackMessage?.recipient);
    const callbackMessageChat = this.readRecord(callbackMessage?.chat);

    const candidates = [
      update.chat_type,
      update.chatType,
      update.dialog_type,
      update.dialogType,
      topChat?.chat_type,
      topChat?.chatType,
      topChat?.type,
      topRecipient?.chat_type,
      topRecipient?.chatType,
      topRecipient?.type,
      msg?.chat_type,
      msg?.chatType,
      msgRecipient?.chat_type,
      msgRecipient?.chatType,
      msgRecipient?.type,
      msgChat?.chat_type,
      msgChat?.chatType,
      msgChat?.type,
      callback?.chat_type,
      callback?.chatType,
      callbackChat?.chat_type,
      callbackChat?.chatType,
      callbackChat?.type,
      callbackRecipient?.chat_type,
      callbackRecipient?.chatType,
      callbackRecipient?.type,
      callbackMessage?.chat_type,
      callbackMessage?.chatType,
      callbackMessageRecipient?.chat_type,
      callbackMessageRecipient?.chatType,
      callbackMessageRecipient?.type,
      callbackMessageChat?.chat_type,
      callbackMessageChat?.chatType,
      callbackMessageChat?.type,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim().toLowerCase();
      }
    }
    return null;
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  }

  private extractCallbackId(update: MaxBotUpdate): string | null {
    const callback = update.callback && typeof update.callback === 'object'
      ? (update.callback as Record<string, unknown>)
      : null;
    const candidates = [
      update.callback_id,
      update.callbackId,
      callback?.callback_id,
      callback?.callbackId,
      callback?.id,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
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

  async handleWebhookUpdate(update: MaxBotUpdate) {
    await this.processCommandUpdates([update]);
  }

  async getSubscriptions() {
    return this.requestJson<unknown>('/subscriptions');
  }

  async registerWebhook(params: { url: string; updateTypes?: string[]; secret?: string }) {
    const body: Record<string, unknown> = {
      url: params.url,
      update_types: params.updateTypes ?? [...MAX_BOT_COMMAND_UPDATE_TYPES],
    };
    if (params.secret) body.secret = params.secret;
    return this.requestJson<unknown>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deleteSubscriptions() {
    return this.requestJson<unknown>('/subscriptions', { method: 'DELETE' });
  }

  async registerMinimalCommandMenu() {
    return this.requestJson<unknown>('/me/commands', {
      method: 'PATCH',
      body: JSON.stringify({ commands: buildMinimalMaxBotCommands() }),
    });
  }

  private async answerCallback(callbackId: string, message: MaxBotMessageBody) {
    return this.requestJson<unknown>(
      `/answers?callback_id=${encodeURIComponent(callbackId)}`,
      {
        method: 'POST',
        body: JSON.stringify({ message }),
      },
    );
  }

  private async processCommandUpdates(updates: MaxBotUpdate[]) {
    const commandService = this.commandService;
    const groupChatId = this.groupChatId;
    if (!commandService) {
      this.logger.warn(
        {
          reason: 'command_service_missing',
          updates: updates.length,
        },
        'max_bot_command_ignored',
      );
      return;
    }

    for (const update of updates) {
      const chatId = this.extractChatId(update);
      const chatType = this.extractChatType(update);
      const chatDecision = chatId === null
        ? null
        : this.classifyCommandChat(update, chatId, chatType, groupChatId);
      this.logger.log(
        {
          update_type: typeof update.update_type === 'string' ? update.update_type : null,
          chatId,
          chatType,
          chatScope: chatDecision?.scope ?? null,
          hasMessage: !!update.message,
        },
        'max_bot_update_received',
      );
      if (chatId === null) {
        this.logger.log(
          {
            reason: 'missing_chat_id',
            update_type: typeof update.update_type === 'string' ? update.update_type : null,
          },
          'max_bot_update_ignored',
        );
        continue;
      }
      if (!chatDecision?.allowed) {
        this.logger.log(
          {
            reason: chatDecision?.reason ?? 'untrusted_chat',
            chatId,
            chatType,
            chatScope: chatDecision?.scope ?? 'unknown',
            groupChatId,
          },
          'max_bot_update_ignored',
        );
        continue;
      }

      let response: MaxBotCommandResponse | null = null;
      try {
        response = await commandService.handleUpdate(update);
      } catch (err) {
        this.logger.warn({ err }, 'max_bot_command_handle_error');
      }
      if (!response) continue;

      const responseText = response.text || '';

      this.logger.log(
        {
          chatId,
          responseLength: responseText.length,
        },
        'max_bot_command_handled',
      );

      try {
        const callbackId = this.extractCallbackId(update);
        if (callbackId) {
          await this.answerCallback(callbackId, response);
        } else {
          await this.sendRawMessage(chatId, response);
        }
        this.logger.log(
          {
            chatId,
            responseLength: responseText.length,
            transport: callbackId ? 'answers' : 'messages',
          },
          'max_bot_command_response_sent',
        );
      } catch (err) {
        this.logger.warn({ err, chatId }, 'max_bot_command_reply_failed');
      }
    }
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

    await this.processCommandUpdates(updates);

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

    const message = this.composeTestMessage(params);
    const frontendUrl = this.buildFrontendLink(params.ticketId);
    const result = await this.requestJson<MaxBotSendMessageResponse>(
      `/messages?chat_id=${encodeURIComponent(String(chatId))}`,
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
    );

    this.logger.log({ chatId, text: message.text }, 'max_bot_message_sent');

    return {
      chatId,
      lastChatId: this.lastChatId,
      frontendUrl,
      text: message.text,
      attachments: message.attachments,
      ...result,
    };
  }
}
