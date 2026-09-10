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
 *   Ticket               номер, дата, проблема, категория, статус, исполнитель
 *   TicketStatusHistory  комментарий приёмки — единственный надёжный «результат»
 *   TicketAttachment     вложения с purpose = WORK_REPORT
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
  changedBy?: { firstName: string | null; lastName: string | null; email: string } | null;
};

export type HistoryAttachmentRow = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  createdAt: Date;
};

export type HistoryPersonRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company?: { id: string; name: string } | null;
} | null;

export type HistoryTicketRow = {
  id: string;
  ticketNumber: number;
  createdAt: Date;
  closedAt: Date | null;
  status: TicketStatus;
  problemText: string;
  problemCategory?: { name: string } | null;
  assignedTechnician?: HistoryPersonRow;
  statusHistory: HistoryStatusRow[];
  attachments: HistoryAttachmentRow[];
};

export type HistoryPartRow = {
  id: string;
  displayName: string;
  serialNumber: string | null;
  quantity: unknown;
  installedTicketId: string | null;
  removedTicketId: string | null;
};

export type HistoryEntry = {
  ticketId: string;
  ticketNumber: number;
  createdAt: Date;
  closedAt: Date | null;
  status: TicketStatus;
  problem: string;
  category: string | null;
  performedBy: string | null;
  performedByCompany: string | null;
  result: string | null;
  resultAt: Date | null;
  workReports: HistoryAttachmentRow[];
  /** Заполняется только из InstalledPart, из текста заявки не выводится. */
  partsInstalled: Array<{ id: string; name: string; serialNumber: string | null; quantity: string }>;
  partsRemoved: Array<{ id: string; name: string; serialNumber: string | null; quantity: string }>;
};

/** Человекочитаемое имя: фамилия и имя, иначе почта. */
export function personLabel(person: HistoryPersonRow): string | null {
  if (!person) return null;
  const name = [person.lastName, person.firstName].filter(Boolean).join(' ').trim();
  return name || person.email;
}

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
    id: row.id,
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
    .map((ticket) => {
      const result = resolveResult(ticket.statusHistory);
      return {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        createdAt: ticket.createdAt,
        closedAt: ticket.closedAt,
        status: ticket.status,
        problem: ticket.problemText,
        category: ticket.problemCategory?.name ?? null,
        performedBy: personLabel(ticket.assignedTechnician ?? null),
        performedByCompany: ticket.assignedTechnician?.company?.name ?? null,
        result: result.text,
        resultAt: result.at,
        workReports: ticket.attachments ?? [],
        partsInstalled: (installedByTicket.get(ticket.id) ?? []).map(partView),
        partsRemoved: (removedByTicket.get(ticket.id) ?? []).map(partView),
      };
    });
}
