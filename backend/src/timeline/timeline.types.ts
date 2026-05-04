export type TimelineEvent =
  | 'TICKET_CREATED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_CLAIMED'
  | 'TICKET_ASSIGNMENT_REQUESTED'
  | 'STATUS_CHANGED'
  | 'COMMENT_ADDED'
  | 'SLA_WARNING'
  | 'SLA_BREACH';

export type TimelineActor = {
  id: string;
  email: string;
} | null;

export type TimelineHistoryItem = {
  id: string;
  at: Date;
  timelineEvent: 'STATUS_CHANGED';
  title: string;
  actor: TimelineActor;
  payload: {
    fromStatus: string | null;
    toStatus: string;
    comment: string | null;
  };
};

export type TimelineRecordedEventItem = {
  id: string;
  ticketId: string;
  at: Date;
  timelineEvent: TimelineEvent;
  domainType: string;
  title: string;
  actor: TimelineActor;
  payload: any;
};

export type TimelineEntry = {
  at: Date;
  source: 'history' | 'event';
  timelineEvent: TimelineEvent;
  domainType: string;
  title: string;
  actor: TimelineActor;
  payload: any;
};
