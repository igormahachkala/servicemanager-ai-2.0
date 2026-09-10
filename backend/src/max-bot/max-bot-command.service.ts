import { Injectable, Logger } from '@nestjs/common';
import { CompanyType } from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import { PrismaService } from '../prisma/prisma.service';
import { MaxIdentity, MaxIdentityService } from './max-identity.service';
import {
  buildMenuModel,
  buildUnboundMenuModel,
  isSafeMaxCallbackPayload,
  normalizeMaxBotUsername,
  renderHelpMessage,
  renderLegacyNavigationMessage,
  renderMenuMessage,
  renderMenuText,
  renderWorkspaceNavigationMessage,
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

type MaxWorkspaceTextAction = {
  normalizedTexts: readonly string[];
  target: string;
  buttonLabel: string;
  text: string;
};

const TEXT_ACTIONS: MaxWorkspaceTextAction[] = [
  {
    normalizedTexts: ['мои заявки'],
    target: 'list_my',
    buttonLabel: 'Мои заявки',
    text: 'Откройте список ваших заявок.',
  },
  {
    normalizedTexts: ['открыть заявку', 'заявка'],
    target: 'list_my',
    buttonLabel: 'Мои заявки',
    text: 'Откройте нужную заявку из списка. Карточка покажет только разрешённые действия.',
  },
  {
    normalizedTexts: ['моя смена', 'смена'],
    target: 'shift',
    buttonLabel: 'Моя смена',
    text: 'Откройте состояние вашей смены.',
  },
  {
    normalizedTexts: ['сегодня'],
    target: 'today',
    buttonLabel: 'Сегодня',
    text: 'Откройте заявки на сегодня.',
  },
  {
    normalizedTexts: ['обходы', 'мои обходы', 'доступные обходы'],
    target: 'rounds',
    buttonLabel: 'Обходы',
    text: 'Откройте доступные обходы.',
  },
];

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

  async handleUpdate(
    update: MaxBotUpdate,
  ): Promise<MaxBotCommandResponse | null> {
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
      if (!isCommand) {
        const action = this.matchTextAction(trimmed);
        if (action) {
          return this.handleParsedCommand(
            '(text-action)',
            this.textActionMessage(update, action),
          );
        }
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
   * Menu for the current viewer. The MAX identity only identifies the user; permissions
   * are resolved from the same PBAC tables used by PermissionsGuard. Ticket/location
   * access remains in the existing HTTP services reached by the Mini App routes.
   */
  private async menuModelFor(update: MaxBotUpdate): Promise<MaxMenuModel> {
    if (!this.identity) return buildUnboundMenuModel();
    const identity = await this.identity.resolve(update);
    if (!identity.resolved) {
      this.logger.log(
        { reason: identity.reason },
        'max_bot_identity_unresolved',
      );
      return buildUnboundMenuModel();
    }
    const capabilities = await this.resolveMenuCapabilities(identity);
    if (!capabilities) return buildUnboundMenuModel();
    return buildMenuModel(capabilities);
  }

  private async menuMessage(
    update: MaxBotUpdate,
  ): Promise<MaxBotCommandResponse> {
    const model = await this.menuModelFor(update);
    return renderMenuMessage(model, this.botUsername);
  }

  private async unknownInputMessage(
    update: MaxBotUpdate,
  ): Promise<MaxBotCommandResponse> {
    const model = await this.menuModelFor(update);
    const menu = renderMenuMessage(model, this.botUsername);
    return {
      ...menu,
      text: `Не понял запрос. Вот что можно сделать:\n\n${menu.text || renderMenuText(model)}`,
    };
  }

  private async textActionMessage(
    update: MaxBotUpdate,
    action: MaxWorkspaceTextAction,
  ): Promise<MaxBotCommandResponse> {
    const model = await this.menuModelFor(update);
    const allowed = model.items.some((item) => item.target === action.target);
    if (!allowed) {
      const menu = renderMenuMessage(model, this.botUsername);
      return {
        ...menu,
        text: `Действие недоступно для вашей роли.\n\n${menu.text || renderMenuText(model)}`,
      };
    }

    return renderWorkspaceNavigationMessage({
      text: action.text,
      buttonLabel: action.buttonLabel,
      botUsername: this.botUsername,
      target: action.target,
    });
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
    return 'Сервис Менеджер бот онлайн\nОткройте меню, чтобы перейти к заявкам, смене или обходам.';
  }

  private statusMessage(): MaxBotCommandResponse {
    return { text: this.statusText() };
  }

  private async resolveMenuCapabilities(
    identity: Extract<MaxIdentity, { resolved: true }>,
  ) {
    if (!this.prisma) return null;

    const company = await this.prisma.company.findUnique({
      where: { id: identity.companyId },
      select: { type: true },
    });
    if (!company) {
      this.logger.warn(
        { companyId: identity.companyId },
        'max_bot_menu_company_missing',
      );
      return null;
    }

    const blocksCount = await this.prisma.permissionBlock.count();
    if (blocksCount === 0) {
      this.logger.warn(
        { userId: identity.userId },
        'max_bot_menu_pbac_not_initialized',
      );
      return {
        role: identity.role,
        companyType: company.type,
        permissions: [] as string[],
      };
    }

    const [roleGrants, userGrants] = await Promise.all([
      this.prisma.rolePermission.findMany({
        where: {
          role: identity.role,
          OR: [{ companyType: company.type }, { companyType: null }],
        },
        select: { permissionBlock: { select: { code: true } } },
      }),
      this.prisma.userPermission.findMany({
        where: { userId: identity.userId },
        select: { permissionBlock: { select: { code: true } } },
      }),
    ]);

    const allowedCodes = new Set(Object.values(PERMISSIONS) as string[]);
    const permissions = [...roleGrants, ...userGrants]
      .map((grant) => grant.permissionBlock.code)
      .filter((code) => allowedCodes.has(code));

    return {
      role: identity.role,
      companyType: company.type as CompanyType,
      permissions: Array.from(new Set(permissions)).sort(),
    };
  }

  private async handleParsedCommand(
    cmd: string,
    response: MaxBotCommandResponse | Promise<MaxBotCommandResponse>,
  ) {
    this.logger.log({ command: cmd }, 'max_bot_command_handled');
    return response;
  }

  private async handleCallback(
    update: MaxBotUpdate,
    payload: string,
  ): Promise<MaxBotCommandResponse> {
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

  private normalizeUserText(value: string) {
    return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  private matchTextAction(value: string) {
    const normalized = this.normalizeUserText(value);
    return TEXT_ACTIONS.find((action) =>
      action.normalizedTexts.some(
        (candidate) => this.normalizeUserText(candidate) === normalized,
      ),
    );
  }

  private isBotStarted(update: MaxBotUpdate) {
    return update.update_type === 'bot_started';
  }

  private extractMessageText(
    update: MaxBotUpdate,
  ): { text: string; source: string } | null {
    const message = update.message;
    if (message && typeof message === 'object') {
      const msg = message as Record<string, unknown>;
      if (typeof msg.text === 'string')
        return { text: msg.text, source: 'message.text' };
      if (typeof msg.body === 'string')
        return { text: msg.body, source: 'message.body' };
      // MAX webhook: message.body is an object { mid, seq, text }
      if (msg.body && typeof msg.body === 'object') {
        const bodyObj = msg.body as Record<string, unknown>;
        if (typeof bodyObj.text === 'string')
          return { text: bodyObj.text, source: 'message.body.text' };
      }
    }
    if (typeof update.text === 'string')
      return { text: update.text, source: 'update.text' };
    return null;
  }

  private extractCallback(
    update: MaxBotUpdate,
  ): { payload: string; source: string } | null {
    const callback = update.callback;
    if (!callback || typeof callback !== 'object') return null;
    const cb = callback as Record<string, unknown>;
    if (typeof cb.payload === 'string') {
      return { payload: cb.payload.trim(), source: 'callback.payload' };
    }
    return null;
  }
}
