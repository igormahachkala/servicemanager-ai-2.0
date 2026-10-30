import { TicketStatus } from '@prisma/client';

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * Сборка истории обслуживания единицы оборудования из канонических данных.
 * Обращений к базе здесь нет: на вход приходят уже отобранные строки.
 *
 * Своей таблицы жизненного цикла модуль не заводит. Всё берётся из того, что
 * уже ведёт система заявок:
 *
 *   Ticket               дата обращения, описание предмета обращения
 *   TicketStatusHistory  комментарий приёмки — единственный надёжный «результат»
 *   InstalledPart        что именно поставили и сняли по этой заявке
 *
 * Ключевое ограничение, заданное постановкой: **что заменили, из текста
 * не выводится**. problemText и комментарий приёмки — свободный текст, и
 * распознавание «заменил датчик» по нему давало бы правдоподобную выдумку.
 * Поэтому состав работ по детали появляется в записи истории только тогда,
 * когда он занесён в InstalledPart, то есть введён человеком явно.
 */

/** Переходы, комментарий к которым осмысленно считать результатом работ. */
const COMPLETION_STATUSES: TicketStatus[] = [
  TicketStatus.AWAITING_ACCEPTANCE,
  TicketStatus.DONE,
];

export type HistoryStatusRow = {
  toStatus: TicketStatus;
  comment: string | null;
  createdAt: Date;
};

export type HistoryTicketRow = {
  id: string;
  createdAt: Date;
  problemText: string;
  statusHistory: HistoryStatusRow[];
};

export type HistoryPartRow = {
  displayName: string;
  serialNumber: string | null;
  quantity: unknown;
  installedTicketId: string | null;
  removedTicketId: string | null;
};

/** Technical projection only; equipment visibility does not grant ticket-detail access.
 * Free-form problem/result text is preserved as entered, not automatically redacted.
 */
export type HistoryEntry = {
  /** Internal stable key / parts association, not a ticket-detail link. */
  ticketId: string;
  /** Date the request was recorded, NOT a completion date. */
  createdAt: Date;
  problem: string;
  result: string | null;
  /** Date the result was recorded; null does not imply work was completed. */
  resultAt: Date | null;
  /** @deprecated Empty compatibility sentinel for cached clients; never contains files. */
  workReports: [];
  /** Explicitly recorded InstalledPart operations, never inferred from text. */
  partsInstalled: Array<{ name: string; serialNumber: string | null; quantity: string }>;
  partsRemoved: Array<{ name: string; serialNumber: string | null; quantity: string }>;
};

/**
 * Результат работ. Берётся комментарий перехода в приёмку либо в закрытие —
 * первый непустой. Придумывать результат из статуса нельзя: «DONE» само по себе
 * не рассказывает, что сделали.
 */
export function resolveResult(rows: HistoryStatusRow[]): { text: string | null; at: Date | null } {
  const completions = [...(rows ?? [])]
    .filter((row) => COMPLETION_STATUSES.includes(row.toStatus))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const row of completions) {
    const text = (row.comment || '').trim();
    if (text) return { text, at: row.createdAt };
  }
  return { text: null, at: completions[0]?.createdAt ?? null };
}

function partView(row: HistoryPartRow) {
  return {
    name: row.displayName,
    serialNumber: row.serialNumber,
    quantity: String(row.quantity),
  };
}

export function buildEquipmentHistory(
  tickets: HistoryTicketRow[],
  parts: HistoryPartRow[] = [],
): HistoryEntry[] {
  const installedByTicket = new Map<string, HistoryPartRow[]>();
  const removedByTicket = new Map<string, HistoryPartRow[]>();
  for (const part of parts) {
    if (part.installedTicketId) {
      const list = installedByTicket.get(part.installedTicketId) ?? [];
      list.push(part);
      installedByTicket.set(part.installedTicketId, list);
    }
    if (part.removedTicketId) {
      const list = removedByTicket.get(part.removedTicketId) ?? [];
      list.push(part);
      removedByTicket.set(part.removedTicketId, list);
    }
  }

  return [...tickets]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((ticket): HistoryEntry => {
      const result = resolveResult(ticket.statusHistory);
      return {
        ticketId: ticket.id,
        createdAt: ticket.createdAt,
        problem: ticket.problemText,
        result: result.text,
        resultAt: result.at,
        // Older clients read .length unconditionally. Never copy source attachments.
        workReports: [],
        partsInstalled: (installedByTicket.get(ticket.id) ?? []).map(partView),
        partsRemoved: (removedByTicket.get(ticket.id) ?? []).map(partView),
      };
    });
}
