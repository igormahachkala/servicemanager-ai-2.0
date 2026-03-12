export type DomainEntityType = 'Ticket' | 'User' | 'SLA';

export type DomainEventType =
  | 'ticket.created'
  | 'ticket.assigned'
  | 'ticket.claimed'
  | 'ticket.reassigned'
  | 'ticket.category_changed'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'ticket.sla_warning'
  | 'ticket.sla_breached'
  | 'sla.breached'
  | 'user.created';

export type DomainEvent = {
  type: DomainEventType;
  companyId: string;
  entityType: DomainEntityType;
  entityId: string;
  actorUserId: string | null;
  payload?: Record<string, any>;
  createdAt?: Date;
};
