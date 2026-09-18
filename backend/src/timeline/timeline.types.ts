export type TimelineEvent =
  | 'TICKET_CREATED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_CLAIMED'
  | 'TICKET_ASSIGNMENT_CHANGED'
  | 'TICKET_ATTACHMENT_UPLOADED'
  | 'TICKET_ASSIGNMENT_REQUESTED'
  | 'TICKET_FIELDS_UPDATED'
  | 'STATUS_CHANGED'
  | 'COMMENT_ADDED'
  | 'SLA_WARNING'
  | 'SLA_BREACH'
  | 'TICKET_READY_FOR_ACCEPTANCE'
  | 'TICKET_ACCEPTED'
  | 'TICKET_REJECTED';

export type TimelineActor = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  companyId?: string | null;
  company?: {
    id: string;
    name: string;
    legalName?: string | null;
    brandName?: string | null;
    type?: string | null;
  } | null;
} | null;

/**
 * SMA-TICKET-REPLY-READ-PATH-120R — предпросмотр исходного сообщения.
 *
 * Отдаётся уже разрешённым: интерфейсу не нужно доставать цель отдельным
 * запросом, а значит и не нужно право на неё. Цель всегда принадлежит той же
 * заявке, что и сам ответ, поэтому ничего сверх уже разрешённой ленты
 * предпросмотр не открывает.
 */
export type TimelineReplyPreview = {
  id: string;
  author: TimelineActor;
  /** Обрезанное начало исходного сообщения. Полного текста здесь нет намеренно. */
  bodyPreview: string;
  /**
   * Исходное сообщение недоступно: вне области видимости либо его содержимое
   * снято. Тела в этом случае не отдаётся вовсе — ни обрезанного, ни пустого.
   */
  unavailable: boolean;
};

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
  /** 120R: заполнено только у комментариев, записанных как TicketComment. */
  commentId: string | null;
  replyTo: TimelineReplyPreview | null;
};

export type TimelineEntry = {
  at: Date;
  source: 'history' | 'event';
  timelineEvent: TimelineEvent;
  domainType: string;
  title: string;
  actor: TimelineActor;
  payload: any;
  /**
   * 120R: устойчивая личность сообщения. У исторических записей она null —
   * клиент опознаёт их как неотвечаемые. Поле присутствует всегда, чтобы
   * «нет личности» и «поле не пришло» не приходилось различать.
   */
  commentId: string | null;
  replyTo: TimelineReplyPreview | null;
};
