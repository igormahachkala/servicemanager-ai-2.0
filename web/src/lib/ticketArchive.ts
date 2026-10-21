import type { BoardResponse, TicketStatus } from './api'

/**
 * SMA-019 — Archive V1.
 * Архив показывает только завершённые и отменённые заявки.
 * Активная доска (/board) показывает остальные статусы.
 */
export const ARCHIVE_TICKET_STATUSES: TicketStatus[] = ['DONE', 'CANCELED']

export function isArchivedTicketStatus(status: TicketStatus): boolean {
  return ARCHIVE_TICKET_STATUSES.includes(status)
}

export function isActiveTicketStatus(status: TicketStatus): boolean {
  return !isArchivedTicketStatus(status)
}

type BoardColumn = BoardResponse['columns'][number]

/** Колонки архива (DONE/CANCELED) из ответа board endpoint. */
export function selectArchiveColumns(board?: BoardResponse | null): BoardColumn[] {
  if (!board) return []
  return board.columns.filter((column) => isArchivedTicketStatus(column.status))
}

/** Колонки активной доски (всё, кроме DONE/CANCELED). */
export function selectActiveColumns(board?: BoardResponse | null): BoardColumn[] {
  if (!board) return []
  return board.columns.filter((column) => isActiveTicketStatus(column.status))
}

/** Суммарное число заявок в архиве по ответу board endpoint. */
export function archiveTicketCount(board?: BoardResponse | null): number {
  return selectArchiveColumns(board).reduce((sum, column) => sum + (column.total || 0), 0)
}

export function archiveStatusLabel(status: TicketStatus): string {
  if (status === 'DONE') return 'Завершённые'
  if (status === 'CANCELED') return 'Отменённые'
  return status
}
