export type DomainEntityType = 'Ticket' | 'User' | 'SLA' | 'InspectionRun' | 'InspectionRunItem';

export type DomainEventType =
  | 'ticket.created'
  | 'ticket.assigned'
  | 'ticket.claimed'
  | 'ticket.attachment_uploaded'
  | 'ticket.reassigned'
  | 'ticket.category_changed'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'ticket.comment_added'
  | 'ticket.assignment_requested'
  | 'ticket.sla_warning'
  | 'ticket.sla_breached'
  | 'sla.breached'
  | 'user.created'
  | 'inspection.item_ticket_created'
  | 'inspection.report_submitted'
  | 'inspection.report_reviewed';

export type DomainEvent = {
  type: DomainEventType;
  companyId: string;
  entityType: DomainEntityType;
  entityId: string;
  actorUserId: string | null;
  payload?: Record<string, any>;
  createdAt?: Date;
};
