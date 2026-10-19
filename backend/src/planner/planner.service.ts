import { Injectable } from '@nestjs/common'
import {
  TicketStatus,
  TicketUrgency,
  UserRole,
  WorkLogStatus,
  WorkShiftStatus,
} from '@prisma/client'

import { InspectionScheduleService } from '../inspection/inspection-schedule.service'
import { PrismaService } from '../prisma/prisma.service'
import { TechniciansService } from '../technicians/technicians.service'
import { TicketsQueryService } from '../tickets/tickets.query.service'
import { filterMaturedCandidates, score } from './planner.scoring'
import type { PlannerPoolItem, ScoreReason, ScoredLocation } from './planner.types'

export type PlannerActor = {
  companyId: string
  userId: string
  role: UserRole
  accessFlags?: { canTechnicianViewAllCompanyTickets?: boolean }
  /** Scope расчёта к одному клиенту. Без него — все bound-контуры. */
  linkedClientCompanyId?: string | null
}

type LocationMeta = {
  locationId: string
  locationName: string
  address: string | null
  clientName: string | null
}

export type PlannerNextWork = {
  kind: 'TICKET' | 'INSPECTION'
  id: string
  ticketId?: string
  scheduleId?: string
  title: string | null
  summary: string | null
  suggestedFirst: boolean
  dispatcherAssigned: boolean
  reasons: ScoreReason[]
  total: number
}

export type PlannerNextObject = LocationMeta & {
  reasons: ScoreReason[]
  works: PlannerNextWork[]
}

export type PlannerNextResponse =
  | { shiftOpen: false }
  | {
      shiftOpen: true
      currentLocationId: string | null
      first: PlannerNextObject | null
      next: PlannerNextObject[]
    }

type BoardCard = {
  id: string
  status: TicketStatus
  urgency?: TicketUrgency | null
  slaDueAt?: Date | null
  title?: string | null
  description?: string | null
  assignedTechnicianId?: string | null
  company?: { id?: string; name?: string | null } | null
  location?: {
    id: string
    name?: string | null
    city?: string | null
    address?: string | null
  } | null
  locationId?: string | null
}

type ScheduleRow = {
  id: string
  name?: string | null
  nextDueAt?: Date | null
  leadTimeDays?: number | null
  intervalDays?: number | null
  frequency?: string | null
  isActive?: boolean
  assignedToUserId?: string | null
  assignedTo?: { id: string } | null
  location?: {
    id: string
    name?: string | null
    city?: string | null
    address?: string | null
    clientCompanyId?: string | null
  } | null
}

type BoundContext = { clientCompany: { id: string; name: string } }

@Injectable()
export class PlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsQuery: TicketsQueryService,
    private readonly technicians: TechniciansService,
    private readonly schedules: InspectionScheduleService,
  ) {}

  async getMyNext(actor: PlannerActor): Promise<PlannerNextResponse> {
    const openShift = await this.prisma.workShift.findFirst({
      where: {
        companyId: actor.companyId,
        userId: actor.userId,
        status: WorkShiftStatus.OPEN,
      },
      select: { id: true },
    })
    if (!openShift) return { shiftOpen: false }

    const contexts = (await this.technicians.getBoundContexts(
      actor.companyId,
      actor.userId,
    )) as BoundContext[]

    const scope = resolveClientScope(contexts, actor.linkedClientCompanyId)
    if (scope.denied) {
      return { shiftOpen: true, currentLocationId: null, first: null, next: [] }
    }

    const clientNameById = new Map<string, string>()
    for (const ctx of contexts) {
      clientNameById.set(ctx.clientCompany.id, ctx.clientCompany.name)
    }

    const locationMeta = new Map<string, LocationMeta>()
    const ticketCards: BoardCard[] = []
    const seenTicketIds = new Set<string>()
    let currentLocationId: string | null = null

    for (const linkedClientCompanyId of scope.linkedClientIds) {
      const board = await this.ticketsQuery.board(
        actor.companyId,
        actor.userId,
        actor.role,
        {},
        actor.accessFlags,
        linkedClientCompanyId,
      )
      const cards = this.flattenBoardCards(board)
      for (const card of cards) {
        if (
          card.status === TicketStatus.IN_PROGRESS &&
          card.assignedTechnicianId === actor.userId
        ) {
          const locId = card.location?.id ?? card.locationId ?? null
          if (locId) currentLocationId = locId
        }

        if (seenTicketIds.has(card.id)) continue
        seenTicketIds.add(card.id)
        ticketCards.push(card)
        this.rememberLocationFromTicket(locationMeta, card, clientNameById)
      }
    }

    if (!currentLocationId) {
      currentLocationId = await this.resolveLocationFromLastWorkLog(openShift.id)
    }

    const poolTicketIds: string[] = []
    const ticketPool: PlannerPoolItem[] = []
    for (const card of ticketCards) {
      const locationId = card.location?.id ?? card.locationId ?? null
      if (!locationId) continue

      const isNewUnassigned =
        card.status === TicketStatus.NEW && !card.assignedTechnicianId
      const isAssignedToMe =
        card.status === TicketStatus.ASSIGNED &&
        card.assignedTechnicianId === actor.userId
      if (!isNewUnassigned && !isAssignedToMe) continue

      poolTicketIds.push(card.id)
      ticketPool.push({
        kind: 'TICKET',
        id: card.id,
        locationId,
        dueAt: card.slaDueAt ?? null,
        urgent: card.urgency === TicketUrgency.URGENT,
        dispatcherAssigned: false,
        title: card.title ?? null,
        summary: card.description ?? null,
      })
    }

    const dispatcherByTicketId = await this.loadDispatcherAssignedFlags(
      poolTicketIds,
      actor.userId,
    )
    for (const item of ticketPool) {
      item.dispatcherAssigned = dispatcherByTicketId.get(item.id) === true
    }

    const scheduleRows = (await this.schedules.list(
      { id: actor.userId, companyId: actor.companyId, role: actor.role },
      { active: 'true' },
    )) as ScheduleRow[]

    const scopedClientId = scope.scopedClientId
    const inspectionPool: PlannerPoolItem[] = []
    for (const schedule of scheduleRows) {
      if (schedule.isActive === false) continue
      const assigneeId = schedule.assignedTo?.id ?? schedule.assignedToUserId ?? null
      if (assigneeId && assigneeId !== actor.userId) continue
      const locationId = schedule.location?.id
      if (!locationId || !schedule.nextDueAt) continue

      if (scopedClientId) {
        const scheduleClientId = schedule.location?.clientCompanyId ?? null
        if (scheduleClientId !== scopedClientId) continue
      }

      this.rememberLocationFromSchedule(locationMeta, schedule, clientNameById)
      inspectionPool.push({
        kind: 'INSPECTION',
        id: schedule.id,
        locationId,
        dueAt: schedule.nextDueAt,
        urgent: false,
        dispatcherAssigned: false,
        title: schedule.name ?? null,
        summary: null,
        intervalDays: schedule.intervalDays ?? null,
        leadTimeDays: schedule.leadTimeDays ?? null,
        frequency: schedule.frequency ?? null,
      })
    }

    const now = new Date()
    const matured = filterMaturedCandidates([...ticketPool, ...inspectionPool], now)
    const scored = score(matured, { now, currentLocationId })

    const objects = scored.map((loc) => this.toNextObject(loc, locationMeta))
    return {
      shiftOpen: true,
      currentLocationId,
      first: objects[0] ?? null,
      next: objects.slice(1, 4),
    }
  }

  private flattenBoardCards(board: { columns?: Array<{ cards?: BoardCard[] }> } | null): BoardCard[] {
    const columns = board?.columns ?? []
    const cards: BoardCard[] = []
    for (const column of columns) {
      for (const card of column.cards ?? []) cards.push(card)
    }
    return cards
  }

  private rememberLocationFromTicket(
    meta: Map<string, LocationMeta>,
    card: BoardCard,
    clientNameById: Map<string, string>,
  ) {
    const locationId = card.location?.id ?? card.locationId
    if (!locationId || meta.has(locationId)) return
    const companyId = card.company?.id
    const clientName =
      card.company?.name ??
      (companyId ? clientNameById.get(companyId) ?? null : null)
    meta.set(locationId, {
      locationId,
      locationName: card.location?.name ?? locationId,
      address: formatAddress(card.location),
      clientName,
    })
  }

  private rememberLocationFromSchedule(
    meta: Map<string, LocationMeta>,
    schedule: ScheduleRow,
    clientNameById: Map<string, string>,
  ) {
    const locationId = schedule.location?.id
    if (!locationId || meta.has(locationId)) return
    const clientCompanyId = schedule.location?.clientCompanyId ?? null
    meta.set(locationId, {
      locationId,
      locationName: schedule.location?.name ?? locationId,
      address: formatAddress(schedule.location),
      clientName: clientCompanyId ? clientNameById.get(clientCompanyId) ?? null : null,
    })
  }

  private async resolveLocationFromLastWorkLog(shiftId: string): Promise<string | null> {
    const lastLog = await this.prisma.workLog.findFirst({
      where: {
        shiftId,
        status: { in: [WorkLogStatus.STOPPED, WorkLogStatus.AUTO_STOPPED] },
      },
      orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }],
      select: {
        ticket: { select: { locationId: true } },
      },
    })
    return lastLog?.ticket?.locationId ?? null
  }

  /**
   * One findMany for all candidate tickets. Per ticket the latest ticket.assigned
   * event decides dispatcherAssigned.
   */
  private async loadDispatcherAssignedFlags(
    ticketIds: string[],
    technicianId: string,
  ): Promise<Map<string, boolean>> {
    const flags = new Map<string, boolean>()
    if (ticketIds.length === 0) return flags

    const events = await this.prisma.domainEvent.findMany({
      where: {
        entityType: 'Ticket',
        entityId: { in: ticketIds },
        type: 'ticket.assigned',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        entityId: true,
        actorUserId: true,
        payload: true,
        createdAt: true,
      },
    })

    const seen = new Set<string>()
    for (const event of events) {
      if (seen.has(event.entityId)) continue
      seen.add(event.entityId)
      flags.set(
        event.entityId,
        isDispatcherAssignedPayload(event.payload, event.actorUserId, technicianId),
      )
    }
    return flags
  }

  private toNextObject(
    location: ScoredLocation,
    meta: Map<string, LocationMeta>,
  ): PlannerNextObject {
    const info = meta.get(location.locationId) ?? {
      locationId: location.locationId,
      locationName: location.locationId,
      address: null,
      clientName: null,
    }
    const works: PlannerNextWork[] = location.works.map((work) => ({
      kind: work.kind,
      id: work.id,
      ...(work.kind === 'TICKET'
        ? { ticketId: work.id }
        : { scheduleId: work.id }),
      title: work.title ?? null,
      summary: work.summary ?? null,
      suggestedFirst: work.suggestedFirst,
      dispatcherAssigned: work.dispatcherAssigned,
      reasons: work.reasons,
      total: work.total,
    }))
    return {
      ...info,
      reasons: works[0]?.reasons ?? [],
      works,
    }
  }
}

/** Which client boards to load. Denied = requested client is not in bound contexts. */
export function resolveClientScope(
  contexts: BoundContext[],
  linkedClientCompanyId?: string | null,
): {
  denied: boolean
  linkedClientIds: Array<string | undefined>
  scopedClientId: string | null
} {
  const requested = (linkedClientCompanyId || '').trim()
  if (!requested) {
    return {
      denied: false,
      linkedClientIds:
        contexts.length > 0
          ? contexts.map((ctx) => ctx.clientCompany.id)
          : [undefined],
      scopedClientId: null,
    }
  }

  if (contexts.length > 0) {
    const allowed = contexts.some((ctx) => ctx.clientCompany.id === requested)
    if (!allowed) {
      return { denied: true, linkedClientIds: [], scopedClientId: null }
    }
  }

  return {
    denied: false,
    linkedClientIds: [requested],
    scopedClientId: requested,
  }
}

function formatAddress(
  location?: { city?: string | null; address?: string | null } | null,
): string | null {
  if (!location) return null
  const parts = [location.city, location.address].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  )
  return parts.length > 0 ? parts.join(', ') : null
}

function isDispatcherAssignedPayload(
  payload: unknown,
  actorUserId: string | null | undefined,
  technicianId: string,
): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const body = payload as Record<string, unknown>
  const mode = body.mode
  if (mode !== 'manual' && mode !== 'reassign') return false
  if (body.assignedTechnicianId !== technicianId) return false
  if (actorUserId === technicianId) return false
  return true
}
