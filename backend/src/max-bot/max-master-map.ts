import { InspectionRunItemStatus, TicketStatus } from '@prisma/client';

import { createdAtTime, formatClock } from './max-master-time';
import {
  MasterTicketListItem,
  ticketStatusLabel,
  ticketUrgencyLabel,
  urgencyRank,
} from './max-master-tickets';

export function isUnassignedNew(ticket: { status: TicketStatus; assignedTechnicianId?: string | null }) {
  return ticket.status === TicketStatus.NEW && !ticket.assignedTechnicianId;
}

export function isOverdue(ticket: { slaBreachedAt?: Date | null; slaDueAt?: Date | null }, now: Date) {
  if (ticket.slaBreachedAt) return true;
  return Boolean(ticket.slaDueAt && new Date(ticket.slaDueAt).getTime() < now.getTime());
}

export function sortMaster(rows: any[], now: Date) {
  return [...rows].sort((a, b) => {
    const overdue = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
    if (overdue) return overdue;
    const urgency = urgencyRank(String(a.urgency || '')) - urgencyRank(String(b.urgency || ''));
    if (urgency) return urgency;
    return createdAtTime(a.createdAt) - createdAtTime(b.createdAt);
  });
}

export function toListItem(ticket: any, timezone?: string | null): MasterTicketListItem {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    locationName: String(ticket.location?.name || 'Без объекта'),
    problemText: clip(String(ticket.problemText || '')),
    urgencyLabel: ticketUrgencyLabel(String(ticket.urgency || '')),
    statusLabel: ticketStatusLabel(String(ticket.status || '')),
    assigneeName: personName(ticket.assignedTechnician),
    categoryName: String(ticket.problemCategory?.name || ''),
    createdLabel: ticket.createdAt ? formatClock(ticket.createdAt, timezone) : '',
    slaLabel: ticket.slaDueAt ? formatClock(ticket.slaDueAt, timezone) : null,
  };
}

export function formatHistoryLine(entry: any) {
  const event = String(entry.timelineEvent || entry.event || '');
  const at = entry.at ? formatClock(entry.at, null) : '';
  if (event === 'STATUS_CHANGED') {
    return `${at} ${ticketStatusLabel(String(entry.payload?.fromStatus || ''))} → ${ticketStatusLabel(String(entry.payload?.toStatus || ''))}`.trim();
  }
  if (event === 'COMMENT_ADDED' || event === 'COMMENT') {
    return `${at} комментарий: ${clip(String(entry.payload?.comment || ''), 80)}`.trim();
  }
  return at ? `${at} ${event}` : event || null;
}

export function reportStatus(status: string): 'ok' | 'issue' | 'critical' | 'skipped' {
  if (status === InspectionRunItemStatus.CRITICAL) return 'critical';
  if (status === InspectionRunItemStatus.ISSUE) return 'issue';
  if (status === InspectionRunItemStatus.SKIPPED) return 'skipped';
  return 'ok';
}

export function personName(user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
  const name = [user?.firstName, user?.lastName]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();
  return name || user?.email || 'Не назначен';
}

export function clip(text: string, max = 80) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}
