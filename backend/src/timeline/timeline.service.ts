import { Injectable } from '@nestjs/common'
import { Prisma, ServiceContractRole } from '@prisma/client'

import { emitDomainEvent, emitDomainEventTx } from '../events/events.bus'
import { type DomainEvent, type DomainEventType } from '../events/events.types'
import { type UserCtx } from '../policy/tickets.policy'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { resolveReadableTicketAccess } from '../tickets/ticket-access.utils'

import {
  type TimelineActor,
  type TimelineEntry,
  type TimelineEvent,
  type TimelineHistoryItem,
  type TimelineRecordedEventItem,
} from './timeline.types'

@Injectable()
export class TimelineService {
  private readonly eventToDomainType: Record<TimelineEvent, DomainEventType> = {
    TICKET_CREATED: 'ticket.created',
    TICKET_ASSIGNED: 'ticket.assigned',
    TICKET_CLAIMED: 'ticket.claimed',
    TICKET_ATTACHMENT_UPLOADED: 'ticket.attachment_uploaded',
    TICKET_ASSIGNMENT_REQUESTED: 'ticket.assignment_requested',
    STATUS_CHANGED: 'ticket.status_changed',
    COMMENT_ADDED: 'ticket.comment_added',
    SLA_WARNING: 'ticket.sla_warning',
    SLA_BREACH: 'ticket.sla_breached',
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async recordTx(
    tx: Prisma.TransactionClient,
    params: {
      event: TimelineEvent
      companyId: string
      ticketId: string
      actorUserId?: string | null
      payload?: Record<string, any>
      createdAt?: Date
    },
  ) {
    const { event, companyId, ticketId, actorUserId, payload, createdAt } = params

    return emitDomainEventTx(tx, {
      type: this.eventToDomainType[event],
      companyId,
      entityType: 'Ticket',
      entityId: ticketId,
      actorUserId: actorUserId ?? null,
      payload,
      createdAt,
    })
  }

  record(params: {
    event: TimelineEvent
    companyId: string
    ticketId: string
    actorUserId?: string | null
    payload?: Record<string, any>
    createdAt?: Date
  }) {
    const { event, companyId, ticketId, actorUserId, payload, createdAt } = params

    return emitDomainEvent({
      type: this.eventToDomainType[event],
      companyId,
      entityType: 'Ticket',
      entityId: ticketId,
      actorUserId: actorUserId ?? null,
      payload,
      createdAt,
    })
  }

  async recordLegacyTx(tx: Prisma.TransactionClient, ev: DomainEvent) {
    return emitDomainEventTx(tx, ev)
  }

  recordLegacy(ev: DomainEvent) {
    return emitDomainEvent(ev)
  }

  async listTicketEvents(companyId: string, ticketIds: string[]) {
    if (ticketIds.length === 0) return []

    const events = await this.prisma.domainEvent.findMany({
      where: {
        companyId,
        entityType: 'Ticket',
        entityId: { in: ticketIds },
      },
      orderBy: [{ entityId: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        entityId: true,
        type: true,
        actorUserId: true,
        payload: true,
        createdAt: true,
      },
    })

    return events
      .map((event) => {
        const timelineEvent = this.toTimelineEvent(event.type)
        if (!timelineEvent) return null

        return {
          id: event.id,
          ticketId: event.entityId,
          at: event.createdAt,
          timelineEvent,
          domainType: event.type,
          actorUserId: event.actorUserId,
          payload: event.payload ?? null,
        }
      })
      .filter((event): event is NonNullable<typeof event> => event !== null)
  }

  async getTicketTimeline(
    user: UserCtx,
    ticketId: string,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    const readable = await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: user.id,
        role: user.role,
        companyId: user.companyId,
        accessFlags: user.accessFlags,
      },
      ticketId,
      linkedClientCompanyId,
      observerCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    const [historyRows, eventRows] = await Promise.all([
      this.prisma.ticketStatusHistory.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          comment: true,
          changedByUserId: true,
          createdAt: true,
        },
      }),
      this.prisma.domainEvent.findMany({
        where: {
          companyId: readable.ticket.companyId,
          entityType: 'Ticket',
          entityId: ticketId,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          entityId: true,
          type: true,
          actorUserId: true,
          payload: true,
          createdAt: true,
        },
      }),
    ])

    const actorIds = new Set<string>()
    for (const row of historyRows) if (row.changedByUserId) actorIds.add(row.changedByUserId)
    for (const row of eventRows) if (row.actorUserId) actorIds.add(row.actorUserId)

    const actors = actorIds.size
      ? await this.prisma.user.findMany({
          where: { id: { in: Array.from(actorIds) } },
          select: { id: true, email: true },
        })
      : []

    const actorMap = new Map<string, NonNullable<TimelineActor>>(actors.map((actor) => [actor.id, actor]))

    const history: TimelineHistoryItem[] = historyRows.map((row) => ({
      id: row.id,
      at: row.createdAt,
      timelineEvent: 'STATUS_CHANGED',
      title: `Status changed: ${row.toStatus}`,
      actor: row.changedByUserId ? actorMap.get(row.changedByUserId) ?? null : null,
      payload: {
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        comment: row.comment ?? null,
      },
    }))

    const events: TimelineRecordedEventItem[] = eventRows
      .map((row) => {
        const timelineEvent = this.toTimelineEvent(row.type)
        if (!timelineEvent) return null

        return {
          id: row.id,
          ticketId: row.entityId,
          at: row.createdAt,
          timelineEvent,
          domainType: row.type,
          title: this.eventTitle(row.type),
          actor: row.actorUserId ? actorMap.get(row.actorUserId) ?? null : null,
          payload: row.payload ?? null,
        }
      })
      .filter((row): row is TimelineRecordedEventItem => row !== null)

    const timeline: TimelineEntry[] = [
      ...history.map((item) => ({
        at: item.at,
        source: 'history' as const,
        timelineEvent: item.timelineEvent,
        domainType: 'ticket.status_history',
        title: item.title,
        actor: item.actor,
        payload: item.payload,
      })),
      ...events.map((item) => ({
        at: item.at,
        source: 'event' as const,
        timelineEvent: item.timelineEvent,
        domainType: item.domainType,
        title: item.title,
        actor: item.actor,
        payload: item.payload,
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime())

    return {
      ticketId,
      timeline,
      history,
      events,
      meta: {
        historyCount: history.length,
        eventCount: events.length,
        scopeCompanyId: readable.ticket.companyId,
        visibilityMode: readable.visibilityMode,
      },
    }
  }

  private toTimelineEvent(type: string): TimelineEvent | null {
    if (type === 'ticket.created') return 'TICKET_CREATED'
    if (type === 'ticket.assigned') return 'TICKET_ASSIGNED'
    if (type === 'ticket.claimed') return 'TICKET_CLAIMED'
    if (type === 'ticket.attachment_uploaded') return 'TICKET_ATTACHMENT_UPLOADED'
    if (type === 'ticket.assignment_requested') return 'TICKET_ASSIGNMENT_REQUESTED'
    if (type === 'ticket.status_changed') return 'STATUS_CHANGED'
    if (type === 'ticket.comment_added') return 'COMMENT_ADDED'
    if (type === 'ticket.sla_warning') return 'SLA_WARNING'
    if (type === 'ticket.sla_breached' || type === 'sla.breached') return 'SLA_BREACH'

    return null
  }

  private eventTitle(type: string) {
    if (type === 'ticket.created') return 'Ticket created'
    if (type === 'ticket.assigned') return 'Ticket assigned'
    if (type === 'ticket.claimed') return 'Ticket claimed'
    if (type === 'ticket.attachment_uploaded') return 'Attachment uploaded'
    if (type === 'ticket.assignment_requested') return 'Запрос назначения'
    if (type === 'ticket.reassigned') return 'Ticket reassigned'
    if (type === 'ticket.category_changed') return 'Ticket category changed'
    if (type === 'ticket.updated') return 'Ticket updated'
    if (type === 'ticket.status_changed') return 'Status changed'
    if (type === 'ticket.comment_added') return 'Comment added'
    if (type === 'ticket.sla_warning') return 'SLA warning'
    if (type === 'ticket.sla_breached' || type === 'sla.breached') return 'SLA breach'
    if (type === 'user.created') return 'User created'

    return type
  }
}
