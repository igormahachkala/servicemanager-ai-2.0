export type DomainEntityType =
  | 'Ticket'
  | 'User'
  | 'SLA'
  | 'InspectionRun'
  | 'InspectionRunItem'
  | 'InspectionSchedule';

export type DomainEventType =
  | 'ticket.created'
  | 'ticket.assigned'
  | 'ticket.claimed'
  | 'ticket.assignment_changed'
  | 'ticket.attachment_uploaded'
  | 'ticket.reassigned'
  | 'ticket.category_changed'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'ticket.comment_added'
  | 'ticket.assignment_requested'
  | 'ticket.sla_warning'
  | 'ticket.sla_breached'
  | 'ticket.ready_for_acceptance'
  | 'ticket.accepted'
  | 'ticket.rejected'
  | 'sla.breached'
  | 'user.created'
  | 'inspection.item_ticket_created'
  | 'inspection.report_submitted'
  | 'inspection.report_reviewed'
  | 'inspection.schedule_created'
  | 'inspection.schedule_updated'
  | 'inspection.schedule_deleted'
  | 'inspection.run_generated'
  | 'inspection.run_overdue';

export type DomainEvent = {
  type: DomainEventType;
  companyId: string;
  entityType: DomainEntityType;
  entityId: string;
  actorUserId: string | null;
  payload?: Record<string, any>;
  createdAt?: Date;
};
