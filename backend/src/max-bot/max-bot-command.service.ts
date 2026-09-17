import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MaxIdentityService } from './max-identity.service';
import {
  buildUnboundMenuModel,
  isSafeMaxCallbackPayload,
  normalizeMaxBotUsername,
  renderHelpMessage,
  renderLegacyNavigationMessage,
  renderMenuMessage,
  renderMenuText,
  type MaxMenuModel,
} from './max-menu.builder';
import { MaxBotCommandResponse, MaxBotUpdate } from './max-bot.types';

/**
 * SMA-MAX-BOT-V2-FOUNDATION-037.
 *
 * The bot answers navigation, never data.
 *
 * Three commands used to read tickets straight out of the database — `/tickets`,
 * `/ticket <n>` and `/open <n>`. None of them filtered by company, location,
 * specialization or contract, and `/ticket` returned the requester's name and phone.
 * Their only gate was "is this the configured group chat", which identifies a room and
 * not a person. That made the bot a second, weaker access resolver sitting beside the
 * accepted one.
 *
 * They are removed rather than hidden. Keeping them behind an undocumented alias would
 * have preserved the exposure while removing the discoverability that makes it auditable.
 * Ticket data now lives exclusively behind the Mini App, where the canonical resolver runs.
 */

/** Commands recognised for backward compatibility. None of them read ticket data. */
const LEGACY_DATA_COMMANDS = new Set(['/tickets', '/ticket', '/open']);

@Injectable()
export class MaxBotCommandService {
  private readonly logger = new Logger(MaxBotCommandService.name);
  private readonly botUsername: string;

  constructor(
    private readonly prisma?: PrismaService,
    private readonly identity?: MaxIdentityService,
  ) {
    this.botUsername = normalizeMaxBotUsername(process.env.MAX_BOT_USERNAME);
  }

  async handleUpdate(update: MaxBotUpdate): Promise<MaxBotCommandResponse | null> {
    const callback = this.extractCallback(update);
    if (callback) {
      return this.handleCallback(update, callback.payload);
    }

    if (this.isBotStarted(update)) {
      this.logger.log(
        {
          update_type: this.safeString(update.update_type),
          source: 'update_type',
          command: '/start',
        },
        'max_bot_command_parsed',
      );
      return this.handleParsedCommand('/start', this.menuMessage(update));
    }

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
    const isCommand = trimmed.startsWith('/');
    const parts = trimmed.split(/\s+/);
    const cmd = isCommand ? parts[0].toLowerCase() : '';

    this.logger.log(
      {
        update_type: this.safeString(update.update_type),
        source: extracted.source,
        command: isCommand ? cmd : '(text)',
      },
      'max_bot_command_parsed',
    );

    try {
      if (cmd === '/start' || cmd === '/menu') {
        return this.handleParsedCommand(cmd, this.menuMessage(update));
      }
      if (cmd === '/help') {
        return this.handleParsedCommand(cmd, this.helpMessage());
      }
      // Operator diagnostic. Retained but absent from user-facing copy.
      if (cmd === '/status') {
        return this.handleParsedCommand(cmd, this.statusMessage());
      }
      if (LEGACY_DATA_COMMANDS.has(cmd)) {
        this.logger.log({ command: cmd }, 'max_bot_legacy_command_redirected');
        return this.handleParsedCommand(cmd, this.legacyRedirectMessage());
      }
    } catch (err) {
      this.logger.warn({ err, cmd }, 'max_bot_command_error');
      return {
        text: 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.',
      };
    }

    // Anything else — unknown command or ordinary text. Previously the bot returned null
    // and said nothing at all, which reads to a user as the bot being broken.
    this.logger.log(
      {
        update_type: this.safeString(update.update_type),
        source: extracted.source,
        reason: isCommand ? 'unknown_command' : 'free_text',
      },
      'max_bot_command_fallback',
    );
    return this.unknownInputMessage(update);
  }

  /**
   * Menu for the current viewer.
   *
   * Until a binding exists every viewer resolves to the unbound menu, which carries no
   * ticket data. Once `MaxIdentityService` can resolve a user, the bound branch will ask
   * the canonical permission services for capabilities and render the role-aware model —
   * the resolver boundary is already in place so that change touches only this method.
   */
  private async menuModelFor(update: MaxBotUpdate): Promise<MaxMenuModel> {
    if (!this.identity) return buildUnboundMenuModel();
    const identity = await this.identity.resolve(update);
    if (!identity.resolved) {
      this.logger.log({ reason: identity.reason }, 'max_bot_identity_unresolved');
      return buildUnboundMenuModel();
    }
    // Role-aware rendering lands with the capability adapter (see max-menu.builder.ts).
    // Until then a resolved user still gets the safe menu: no ticket data either way.
    return buildUnboundMenuModel();
  }

  private async menuMessage(update: MaxBotUpdate): Promise<MaxBotCommandResponse> {
    const model = await this.menuModelFor(update);
    return renderMenuMessage(model, this.botUsername);
  }

  private async unknownInputMessage(update: MaxBotUpdate): Promise<MaxBotCommandResponse> {
    const model = await this.menuModelFor(update);
    const menu = renderMenuMessage(model, this.botUsername);
    return {
      ...menu,
      text: `Не понял запрос. Вот что можно сделать:\n\n${menu.text || renderMenuText(model)}`,
    };
  }

  private helpMessage(): MaxBotCommandResponse {
    return renderHelpMessage(this.botUsername);
  }

  /**
   * Replaces the three ticket-reading commands. Deliberately says nothing about whether
   * any ticket exists — the reply is identical no matter what argument was passed.
   */
  private legacyRedirectMessage(): MaxBotCommandResponse {
    return renderLegacyNavigationMessage(this.botUsername);
  }

  private statusText(): string {
    const now = new Date().toISOString();
    const env = process.env.NODE_ENV || 'production';
    const mode = process.env.MAX_BOT_WEBHOOK_ENABLED === 'true' ? 'webhook' : 'polling';
    return `Сервис Менеджер бот онлайн\nВремя: ${now}\nСреда: ${env}\nРежим: ${mode}`;
  }

  private statusMessage(): MaxBotCommandResponse {
    return { text: this.statusText() };
  }

  private async handleParsedCommand(
    cmd: string,
    response: MaxBotCommandResponse | Promise<MaxBotCommandResponse>,
  ) {
    this.logger.log({ command: cmd }, 'max_bot_command_handled');
    return response;
  }

  private async handleCallback(update: MaxBotUpdate, payload: string): Promise<MaxBotCommandResponse> {
    if (!isSafeMaxCallbackPayload(payload)) {
      this.logger.log({ payload }, 'max_bot_callback_fallback');
      return this.menuMessage(update);
    }
    this.logger.log({ payload }, 'max_bot_callback_handled');
    return payload === 'help' ? this.helpMessage() : this.menuMessage(update);
  }

  private safeString(value: unknown) {
    return typeof value === 'string' ? value : null;
  }

  private isBotStarted(update: MaxBotUpdate) {
    return update.update_type === 'bot_started';
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

  private extractCallback(update: MaxBotUpdate): { payload: string; source: string } | null {
    const callback = update.callback;
    if (!callback || typeof callback !== 'object') return null;
    const cb = callback as Record<string, unknown>;
    if (typeof cb.payload === 'string') {
      return { payload: cb.payload.trim(), source: 'callback.payload' };
    }
    return null;
  }
}
