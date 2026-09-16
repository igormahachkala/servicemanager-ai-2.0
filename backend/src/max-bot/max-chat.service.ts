import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { MaxIdentityService } from './max-identity.service';
import { menuMessage, sectionMessage, isChatCallbackPayload } from './max-chat-keyboard';
import { buildUnboundMenuModel, renderMenuMessage, normalizeMaxBotUsername } from './max-menu.builder';
import { MaxBotCommandResponse, MaxBotUpdate } from './max-bot.types';

const MENU_TEXT = `Сервис Менеджер

Выберите действие.`;

const LABEL_TO_PAYLOAD: Record<string, string> = {
  Сегодня: 'today',
  'Мои заявки': 'my',
  Доступные: 'avail',
  Обходы: 'rounds',
  'Моя смена': 'shift',
  'Поиск заявки': 'find',
};

@Injectable()
export class MaxChatService {
  private readonly botUsername = normalizeMaxBotUsername(process.env.MAX_BOT_USERNAME);

  constructor(private readonly identity?: MaxIdentityService) {}

  async handleMenu(update: MaxBotUpdate): Promise<MaxBotCommandResponse> {
    const identity = await this.resolve(update);
    if (!identity) {
      return renderMenuMessage(buildUnboundMenuModel(), this.botUsername);
    }
    return menuMessage(MENU_TEXT);
  }

  async handleCallback(update: MaxBotUpdate, payload: string): Promise<MaxBotCommandResponse | null> {
    if (!isChatCallbackPayload(payload) && payload !== 'menu') return null;
    if (payload === 'menu') return this.handleMenu(update);
    const identity = await this.resolve(update);
    if (!identity) {
      return renderMenuMessage(buildUnboundMenuModel(), this.botUsername);
    }
    return sectionMessage(`Раздел ещё не подключен.`);
  }

  /**
   * Подписи кнопок MAX type=message приходят текстом. Пока разделы не подключены,
   * совпадение с пунктом меню открывает то же меню.
   */
  matchMenuLabel(text: string): string | null {
    const payload = LABEL_TO_PAYLOAD[text.trim()];
    return payload || null;
  }

  private async resolve(update: MaxBotUpdate) {
    if (!this.identity) return null;
    const identity = await this.identity.resolve(update);
    if (!identity.resolved) return null;
    if (identity.role === UserRole.CLIENT) return null;
    return identity;
  }
}
