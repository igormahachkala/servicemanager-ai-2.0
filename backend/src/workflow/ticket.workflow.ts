import { TicketStatus } from '@prisma/client';
import { WorkflowDecision, allow, deny } from './workflow.types';

/**
 * Ticket Workflow v0
 * Цель: единая таблица переходов, без размазывания if-else по сервисам.
 *
 * Текущий enum в проекте: NEW / ASSIGNED / IN_PROGRESS / AWAITING_ACCEPTANCE / DONE / CANCELED
 */
const ALLOWED: Partial<Record<TicketStatus, TicketStatus[]>> = {
  NEW: ['ASSIGNED', 'IN_PROGRESS', 'CANCELED'] as TicketStatus[],
  ASSIGNED: ['IN_PROGRESS', 'AWAITING_ACCEPTANCE', 'DONE', 'CANCELED'] as TicketStatus[],
  IN_PROGRESS: ['AWAITING_ACCEPTANCE', 'DONE', 'CANCELED'] as TicketStatus[],
  AWAITING_ACCEPTANCE: ['DONE', 'IN_PROGRESS'] as TicketStatus[],
  DONE: [] as TicketStatus[],
  CANCELED: [] as TicketStatus[],
};

export function decideTicketTransition(from: TicketStatus, to: TicketStatus): WorkflowDecision {
  if (from === to) return deny('Same status transition is not allowed');

  const next = ALLOWED[from] ?? [];
  if (!next.includes(to)) return deny(`Invalid status transition: ${from} -> ${to}`);

  return allow();
}
