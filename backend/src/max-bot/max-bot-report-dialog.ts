import { extractMaxUserId, MaxIdentity } from './max-identity.service';
import { MaxIncomingMedia, MaxFileClient } from './max-file.client';
import {
  MaxBotReportStore,
  type MaxBotReportPhotoInput,
} from './max-bot-report.store';
import { MaxBotScreenJournal, type ScreenEntry } from './max-bot-screen-journal';
import { renderInlineKeyboard } from './max-menu.builder';
import {
  MaxBotCommandResponse,
  MaxBotInlineKeyboardButton,
  MaxBotUpdate,
} from './max-bot.types';

type ResolvedIdentity = Extract<MaxIdentity, { resolved: true }>;

export type ReportCallbackPayload =
  | 'report:error'
  | 'report:skip-text'
  | 'report:skip-photo'
  | 'report:cancel'
  | 'report:add-text'
  | 'report:add-photo';

type ReportPhase = 'collect' | 'ask-text' | 'ask-photo' | 'await-text' | 'await-photo';

type ReportWait = {
  phase: ReportPhase;
  screens: ScreenEntry[];
  text: string | null;
  photos: MaxIncomingMedia[];
  userId: string | null;
  companyId: string | null;
  role: string | null;
  textSkipped: boolean;
  photoSkipped: boolean;
};

const PROMPT_COLLECT =
  'Опишите ошибку текстом и/или пришлите скрин. Можно пропустить.';
const PROMPT_ASK_TEXT = 'Добавить описание текстом?';
const PROMPT_ASK_PHOTO = 'Добавить фото?';
const PROMPT_AWAIT_TEXT = 'Напишите описание ошибки.';
const PROMPT_AWAIT_PHOTO = 'Пришлите фото или скрин.';
const PROMPT_SENT = 'Отправлено. Спасибо.';
const PROMPT_CANCELLED = 'Отменено.';
const PROMPT_FAILED = 'Не удалось отправить отчёт.\nПопробуйте ещё раз через минуту.';

const REPORT_CALLBACKS = new Set<string>([
  'report:error',
  'report:skip-text',
  'report:skip-photo',
  'report:cancel',
  'report:add-text',
  'report:add-photo',
]);

export function isReportCallbackPayload(payload: string): payload is ReportCallbackPayload {
  return REPORT_CALLBACKS.has(payload);
}

function callbackButton(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
}

function reportMessage(text: string, rows: MaxBotInlineKeyboardButton[][], kind: string): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard(rows);
  return {
    text,
    kind,
    skipJournal: true,
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

function collectRows(): MaxBotInlineKeyboardButton[][] {
  return [
    [callbackButton('Пропустить', 'report:skip-text'), callbackButton('Отмена', 'report:cancel')],
  ];
}

function askTextRows(): MaxBotInlineKeyboardButton[][] {
  return [
    [callbackButton('Добавить', 'report:add-text'), callbackButton('Отправить без текста', 'report:skip-text')],
    [callbackButton('Отмена', 'report:cancel')],
  ];
}

function askPhotoRows(): MaxBotInlineKeyboardButton[][] {
  return [
    [callbackButton('Добавить', 'report:add-photo'), callbackButton('Отправить без фото', 'report:skip-photo')],
    [callbackButton('Отмена', 'report:cancel')],
  ];
}

function awaitTextRows(): MaxBotInlineKeyboardButton[][] {
  return [[callbackButton('Отмена', 'report:cancel')]];
}

function awaitPhotoRows(): MaxBotInlineKeyboardButton[][] {
  return [
    [callbackButton('Отправить без фото', 'report:skip-photo'), callbackButton('Отмена', 'report:cancel')],
  ];
}

/**
 * Standalone in-memory dialog for «Сообщить об ошибке».
 * Not mixed with ticket/master wait maps.
 */
export class MaxBotReportDialog {
  private readonly wait = new Map<string, ReportWait>();

  constructor(
    private readonly journal?: MaxBotScreenJournal,
    private readonly store?: MaxBotReportStore,
    private readonly files: MaxFileClient = new MaxFileClient(),
  ) {}

  isActive(update: MaxBotUpdate): boolean {
    const maxUserId = extractMaxUserId(update);
    return Boolean(maxUserId && this.wait.has(maxUserId));
  }

  clear(update: MaxBotUpdate): void {
    const maxUserId = extractMaxUserId(update);
    if (maxUserId) this.wait.delete(maxUserId);
  }

  clearByMaxUserId(maxUserId: string): void {
    if (maxUserId) this.wait.delete(maxUserId);
  }

  begin(identity: ResolvedIdentity): MaxBotCommandResponse {
    const screens = this.journal?.snapshot(identity.maxUserId) ?? [];
    this.wait.set(identity.maxUserId, {
      phase: 'collect',
      screens,
      text: null,
      photos: [],
      userId: identity.userId,
      companyId: identity.companyId,
      role: identity.role,
      textSkipped: false,
      photoSkipped: false,
    });
    return reportMessage(PROMPT_COLLECT, collectRows(), 'report:prompt');
  }

  async handleCallback(
    identity: ResolvedIdentity,
    payload: ReportCallbackPayload,
  ): Promise<MaxBotCommandResponse> {
    if (payload === 'report:error') return this.begin(identity);
    if (payload === 'report:cancel') {
      this.wait.delete(identity.maxUserId);
      return reportMessage(PROMPT_CANCELLED, [], 'report:cancelled');
    }

    const state = this.wait.get(identity.maxUserId);
    if (!state) return this.begin(identity);

    if (payload === 'report:add-text') {
      state.phase = 'await-text';
      return reportMessage(PROMPT_AWAIT_TEXT, awaitTextRows(), 'report:await-text');
    }
    if (payload === 'report:add-photo') {
      state.phase = 'await-photo';
      return reportMessage(PROMPT_AWAIT_PHOTO, awaitPhotoRows(), 'report:await-photo');
    }
    if (payload === 'report:skip-text') {
      state.textSkipped = true;
      if (!state.text) state.text = '';
      return this.afterTextResolved(identity, state);
    }
    if (payload === 'report:skip-photo') {
      state.photoSkipped = true;
      return this.submit(identity, state);
    }
    return this.begin(identity);
  }

  async submitContent(
    identity: ResolvedIdentity,
    text: string,
    media: MaxIncomingMedia[],
  ): Promise<MaxBotCommandResponse | null> {
    const state = this.wait.get(identity.maxUserId);
    if (!state) return null;

    const trimmed = text.trim();
    const images = media.filter((item) => item.type === 'image' || item.type === 'file');

    if (state.phase === 'await-text') {
      if (!trimmed) {
        return reportMessage(PROMPT_AWAIT_TEXT, awaitTextRows(), 'report:await-text');
      }
      state.text = trimmed;
      return this.afterTextResolved(identity, state);
    }

    if (state.phase === 'await-photo') {
      if (images.length === 0) {
        return reportMessage(PROMPT_AWAIT_PHOTO, awaitPhotoRows(), 'report:await-photo');
      }
      state.photos.push(...images);
      return this.submit(identity, state);
    }

    if (state.phase === 'collect' || state.phase === 'ask-text' || state.phase === 'ask-photo') {
      if (trimmed) state.text = trimmed;
      if (images.length > 0) state.photos.push(...images);
      if (!trimmed && images.length === 0) {
        if (state.phase === 'collect') {
          return reportMessage(PROMPT_COLLECT, collectRows(), 'report:prompt');
        }
        if (state.phase === 'ask-text') {
          return reportMessage(PROMPT_ASK_TEXT, askTextRows(), 'report:ask-text');
        }
        return reportMessage(PROMPT_ASK_PHOTO, askPhotoRows(), 'report:ask-photo');
      }
      return this.continueAfterContent(identity, state);
    }

    return null;
  }

  private async afterTextResolved(
    identity: ResolvedIdentity,
    state: ReportWait,
  ): Promise<MaxBotCommandResponse> {
    if (state.photos.length > 0 || state.photoSkipped) {
      return this.submit(identity, state);
    }
    state.phase = 'ask-photo';
    return reportMessage(PROMPT_ASK_PHOTO, askPhotoRows(), 'report:ask-photo');
  }

  private async continueAfterContent(
    identity: ResolvedIdentity,
    state: ReportWait,
  ): Promise<MaxBotCommandResponse> {
    const hasText = Boolean(state.text && state.text.trim()) || state.textSkipped;
    const hasPhoto = state.photos.length > 0 || state.photoSkipped;

    if (hasText && hasPhoto) return this.submit(identity, state);

    if (!hasText) {
      state.phase = 'ask-text';
      return reportMessage(PROMPT_ASK_TEXT, askTextRows(), 'report:ask-text');
    }

    state.phase = 'ask-photo';
    return reportMessage(PROMPT_ASK_PHOTO, askPhotoRows(), 'report:ask-photo');
  }

  private async submit(
    identity: ResolvedIdentity,
    state: ReportWait,
  ): Promise<MaxBotCommandResponse> {
    if (!this.store) {
      this.wait.delete(identity.maxUserId);
      return reportMessage(PROMPT_FAILED, [], 'report:failed');
    }

    try {
      const photos: MaxBotReportPhotoInput[] = [];
      for (const media of state.photos) {
        const downloaded = await this.files.download(media);
        photos.push({
          buffer: downloaded.buffer,
          originalname: downloaded.originalname,
          mimetype: downloaded.mimetype,
        });
      }

      await this.store.createErrorReport({
        maxUserId: identity.maxUserId,
        userId: state.userId,
        companyId: state.companyId,
        role: state.role,
        text: state.text ?? '',
        photos,
        screens: state.screens,
      });
    } catch {
      this.wait.delete(identity.maxUserId);
      return reportMessage(PROMPT_FAILED, [], 'report:failed');
    }

    this.wait.delete(identity.maxUserId);
    return reportMessage(PROMPT_SENT, [], 'report:sent');
  }
}
