import { Injectable } from '@nestjs/common';

import type { MaxBotCommandResponse, MaxBotMessageBody } from './max-bot.types';

/** One outbound bot message as recorded for error-report context. Not persisted to DB. */
export type ScreenEntry = {
  at: string;
  kind: string;
  text: string;
  buttons: string[][];
};

const RING_SIZE = 10;
const TEXT_LIMIT = 500;

export function truncateScreenText(text: string, limit = TEXT_LIMIT): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit);
}

export function extractScreenButtons(message: MaxBotMessageBody): string[][] {
  const attachments = message.attachments ?? [];
  const rows: string[][] = [];
  for (const attachment of attachments) {
    if (attachment.type !== 'inline_keyboard') continue;
    const buttonRows = attachment.payload?.buttons ?? [];
    for (const row of buttonRows) {
      rows.push(row.map((button) => (typeof button.text === 'string' ? button.text : '')));
    }
  }
  return rows;
}

export function shouldSkipScreenJournal(response: MaxBotCommandResponse): boolean {
  if (response.skipJournal === true) return true;
  const kind = response.kind ?? '';
  return kind.startsWith('report:');
}

export function screenEntryFromResponse(response: MaxBotCommandResponse, at = new Date().toISOString()): ScreenEntry {
  return {
    at,
    kind: response.kind ?? 'outbound',
    text: truncateScreenText(response.text ?? ''),
    buttons: extractScreenButtons(response),
  };
}

/**
 * In-memory ring of the last N screens per MAX user.
 * Cleared on process restart — acceptable for error-report context.
 */
@Injectable()
export class MaxBotScreenJournal {
  private readonly screens = new Map<string, ScreenEntry[]>();

  push(maxUserId: string, entry: ScreenEntry): void {
    if (!maxUserId) return;
    const current = this.screens.get(maxUserId) ?? [];
    current.push(entry);
    while (current.length > RING_SIZE) {
      current.shift();
    }
    this.screens.set(maxUserId, current);
  }

  /** Returns a shallow copy of the ring; later pushes do not mutate the returned array. */
  snapshot(maxUserId: string): ScreenEntry[] {
    if (!maxUserId) return [];
    const current = this.screens.get(maxUserId) ?? [];
    return current.map((entry) => ({
      ...entry,
      buttons: entry.buttons.map((row) => [...row]),
    }));
  }

  clear(maxUserId: string): void {
    if (!maxUserId) return;
    this.screens.delete(maxUserId);
  }
}
