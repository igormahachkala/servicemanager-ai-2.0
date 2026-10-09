import { Injectable, Logger, Optional } from '@nestjs/common';
import { readFile } from 'fs/promises';

import { MaxFileClient } from './max-file.client';
import { extractMaxUserId } from './max-identity.service';
import {
  findMemoById,
  loadMemosManifest,
  MEMOS_BATCH_DELAY_MS,
  MEMOS_BATCH_SIZE,
  memoFilePath,
  MemoEntry,
  MemoViewerRole,
  parseMemosAction,
  renderMemosListMessage,
  renderMemosSentMessage,
  resolveMemosAssetsDir,
  selectMemosForBatch,
} from './max-bot-memos';
import { MaxBotCommandResponse, MaxBotUpdate } from './max-bot.types';
import { renderPersistentMenuMessage } from './max-menu.builder';

const FAILED = 'Не удалось отправить памятку.\nПопробуйте ещё раз через минуту.';
const MISSING_CHAT = 'Не удалось определить чат для отправки памяток.';

type SleepFn = (ms: number) => Promise<void>;

@Injectable()
export class MaxBotMemosService {
  private readonly logger = new Logger(MaxBotMemosService.name);
  private readonly tokenCache = new Map<string, string>();
  private assetsDir = resolveMemosAssetsDir();
  private sleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  private readonly files: MaxFileClient;

  constructor(@Optional() files?: MaxFileClient) {
    this.files = files ?? new MaxFileClient();
  }

  /** Test-only: override assets dir and batch delay. */
  configureForTests(opts: { assetsDir?: string; sleep?: SleepFn }): void {
    if (opts.assetsDir) this.assetsDir = opts.assetsDir;
    if (opts.sleep) this.sleep = opts.sleep;
  }

  async handleCallback(
    update: MaxBotUpdate,
    payload: string,
    role: MemoViewerRole,
  ): Promise<MaxBotCommandResponse> {
    const action = parseMemosAction(payload);
    if (!action) return renderMemosListMessage(role);

    if (action.kind === 'list') {
      return renderMemosListMessage(role, action.page);
    }

    const chatId = extractMaxChatId(update);
    if (chatId === null) {
      this.logger.warn({ payload }, 'max_bot_memos_missing_chat');
      return renderPersistentMenuMessage(MISSING_CHAT);
    }

    try {
      if (action.kind === 'one') {
        const memo = findMemoById(action.id);
        if (!memo) return renderMemosListMessage(role);
        await this.sendOne(chatId, memo);
        return renderMemosListMessage(role);
      }

      const batch = selectMemosForBatch(action.scope, role);
      const sent = await this.sendBatch(chatId, batch);
      return renderMemosSentMessage(sent);
    } catch (err) {
      this.logger.warn({ err, payload }, 'max_bot_memos_send_failed');
      return renderPersistentMenuMessage(FAILED);
    }
  }

  async sendBatch(chatId: number, memos: MemoEntry[]): Promise<number> {
    let sent = 0;
    for (let i = 0; i < memos.length; i += 1) {
      await this.sendOne(chatId, memos[i]);
      sent += 1;
      if (i + 1 < memos.length && (i + 1) % MEMOS_BATCH_SIZE === 0) {
        await this.sleep(MEMOS_BATCH_DELAY_MS);
      }
    }
    return sent;
  }

  async sendOne(chatId: number, memo: MemoEntry): Promise<void> {
    const imageToken = await this.uploadMemo(memo);
    await this.files.sendImageMessage(chatId, memo.title, imageToken);
  }

  private async uploadMemo(memo: MemoEntry): Promise<string> {
    const cached = this.tokenCache.get(memo.id);
    if (cached) return cached;
    const absolute = memoFilePath(memo, this.assetsDir);
    if (absolute.startsWith('file:')) {
      throw new Error('file:// paths are not allowed');
    }
    const buffer = await readFile(absolute);
    const token = await this.files.uploadImage(buffer, memo.file);
    this.tokenCache.set(memo.id, token);
    return token;
  }

  /** Exposed for tests: confirm manifest loads from the chosen assets dir. */
  listManifest(): MemoEntry[] {
    return loadMemosManifest(this.assetsDir);
  }
}

export function extractMaxChatId(update: MaxBotUpdate): number | null {
  const msg = asRecord(update.message);
  const callback = asRecord(update.callback);
  const callbackMessage = asRecord(callback?.message);
  const candidates = [
    update.chat_id,
    update.chatId,
    update.dialog_id,
    asRecord(update.chat)?.chat_id,
    asRecord(update.chat)?.id,
    asRecord(update.recipient)?.chat_id,
    callback?.chat_id,
    callback?.chatId,
    callback?.dialog_id,
    asRecord(callback?.chat)?.chat_id,
    asRecord(callback?.chat)?.id,
    asRecord(callback?.recipient)?.chat_id,
    msg?.chat_id,
    msg?.dialog_id,
    asRecord(msg?.recipient)?.chat_id,
    asRecord(msg?.chat)?.chat_id,
    callbackMessage?.chat_id,
    callbackMessage?.dialog_id,
    asRecord(callbackMessage?.recipient)?.chat_id,
    asRecord(callbackMessage?.chat)?.chat_id,
    extractMaxUserId(update),
  ];
  for (const candidate of candidates) {
    const n = toFiniteNumber(candidate);
    if (n !== null) return n;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
