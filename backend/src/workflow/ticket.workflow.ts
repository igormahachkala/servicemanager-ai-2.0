import { TicketStatus } from '@prisma/client';
import { WorkflowDecision, allow, deny } from './workflow.types';

/**
 * Ticket Workflow v0
 * Цель: единая таблица переходов, без размазывания if-else по сервисам.
 *
 * Родитель (isChild false): NEW / ASSIGNED / IN_PROGRESS / AWAITING_ACCEPTANCE / DONE / CANCELED.
 * FIELD_COMPLETE родителю недоступен.
 * Ребёнок (подзаявка): полевой конец FIELD_COMPLETE, без своей приёмки и без DONE.
 */
const PARENT_ALLOWED: Partial<Record<TicketStatus, TicketStatus[]>> = {
  NEW: ['ASSIGNED', 'IN_PROGRESS', 'CANCELED'] as TicketStatus[],
  ASSIGNED: ['IN_PROGRESS', 'AWAITING_ACCEPTANCE', 'DONE', 'CANCELED'] as TicketStatus[],
  IN_PROGRESS: ['AWAITING_ACCEPTANCE', 'DONE', 'CANCELED'] as TicketStatus[],
  AWAITING_ACCEPTANCE: ['IN_PROGRESS'] as TicketStatus[],
  DONE: [] as TicketStatus[],
  CANCELED: [] as TicketStatus[],
  FIELD_COMPLETE: [] as TicketStatus[],
};

const CHILD_ALLOWED: Partial<Record<TicketStatus, TicketStatus[]>> = {
  NEW: ['ASSIGNED', 'IN_PROGRESS', 'FIELD_COMPLETE', 'CANCELED'] as TicketStatus[],
  ASSIGNED: ['IN_PROGRESS', 'FIELD_COMPLETE', 'CANCELED'] as TicketStatus[],
  IN_PROGRESS: ['FIELD_COMPLETE', 'CANCELED'] as TicketStatus[],
  FIELD_COMPLETE: ['IN_PROGRESS', 'CANCELED'] as TicketStatus[],
  AWAITING_ACCEPTANCE: [] as TicketStatus[],
  DONE: [] as TicketStatus[],
  CANCELED: [] as TicketStatus[],
};

export function decideTicketTransition(
  from: TicketStatus,
  to: TicketStatus,
  opts?: { isChild?: boolean },
): WorkflowDecision {
  if (from === to) return deny('Same status transition is not allowed');

  const next = (opts?.isChild ? CHILD_ALLOWED : PARENT_ALLOWED)[from] ?? [];
  if (!next.includes(to)) return deny(`Invalid status transition: ${from} -> ${to}`);

  return allow();
}
