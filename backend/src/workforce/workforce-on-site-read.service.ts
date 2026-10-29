import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { TechnicianArrivalEventKind, TicketStatus, WorkShiftStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { OnSiteActor, requireProviderStaff } from './workforce-on-site-access'
import {
  arrivalTicketHref,
  displayedFacts,
  distanceToLocation,
  isFreshPoint,
  lineNotes,
  ON_SITE_OUTCOMES,
  outcomeLabel,
  outcomeRank,
  type OnSiteOutcome,
  type OnSiteShiftFilter,
  type OnSiteSort,
  resolveOutcome,
  staffName,
} from './workforce-on-site.rules'

const ACTIVE_TICKET_STATUSES = [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS]
const SORTS: OnSiteSort[] = ['state', 'name', 'lastPoint', 'distance']
const SHIFTS: OnSiteShiftFilter[] = ['open', 'closed']

export type OnSiteListQuery = {
  state?: string
  shift?: string
  technician?: string
  sort?: string
}

type ShiftRow = {
  status: WorkShiftStatus
  lastLatitude: number | null
  lastLongitude: number | null
  lastGeoAt: Date | null
  openedAt: Date
}

type ArrivalRow = {
  arrivedAt: Date | null
  departedAt: Date | null
  corrections: Array<{
    createdAt: Date
    correctedArrivedAt: Date | null
    correctedDepartedAt: Date | null
  }>
  events: Array<{ createdAt: Date }>
}

export type OnSiteLine = {
  ticketId: string
  ticketNumber: number
  locationName: string
  linkedClientCompanyId: string
  ticketHref: string
  state: OnSiteOutcome
  stateOrder: number
  label: string
  notes: string[]
  text: string
  distanceMeters: number | null
  lastPointAt: string | null
  arrivedAt: string | null
  departedAt: string | null
}

export type OnSiteCard = {
  userId: string
  name: string
  shiftOpen: boolean
  lines: OnSiteLine[]
}

type ParsedQuery = {
  state?: OnSiteOutcome
  shift?: OnSiteShiftFilter
  technician?: string
  sort: OnSiteSort
}

@Injectable()
export class WorkforceOnSiteReadService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: OnSiteActor, query: OnSiteListQuery = {}) {
    const { timezone } = await requireProviderStaff(this.prisma, actor)
    const parsed = parseListQuery(query)
    const now = new Date()
    const cards = await this.loadCards(actor, now, timezone)
    const filtered = sortCards(applyFilters(cards, parsed), parsed.sort)
    return {
      sort: parsed.sort,
      emptyReason: emptyReason(cards.length, filtered.length),
      items: filtered,
    }
  }

  async getTicket(actor: OnSiteActor, ticketId: string) {
    const { timezone } = await requireProviderStaff(this.prisma, actor)
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        status: { in: ACTIVE_TICKET_STATUSES },
        assignedTechnician: { companyId: actor.companyId },
      },
      select: {
        id: true,
        ticketNumber: true,
        companyId: true,
        location: { select: { name: true, latitude: true, longitude: true } },
        assignedTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            workShifts: {
              orderBy: { openedAt: 'desc' },
              take: 5,
              select: {
                status: true,
                lastLatitude: true,
                lastLongitude: true,
                lastGeoAt: true,
                openedAt: true,
              },
            },
          },
        },
      },
    })
    const technician = ticket?.assignedTechnician
    if (!ticket || !technician) throw new NotFoundException('Назначение не найдено')

    const arrival = await this.prisma.technicianArrival.findUnique({
      where: { ticketId_userId: { ticketId: ticket.id, userId: technician.id } },
      select: arrivalSelect,
    })
    const now = new Date()
    const card = toCard(
      {
        id: technician.id,
        firstName: technician.firstName,
        lastName: technician.lastName,
        email: technician.email,
        workShifts: technician.workShifts,
        assignedTickets: [ticket],
      },
      arrival ? new Map([[`${technician.id}:${ticket.id}`, arrival]]) : new Map(),
      now,
      timezone,
    )
    return {
      userId: card.userId,
      name: card.name,
      shiftOpen: card.shiftOpen,
      line: card.lines[0],
    }
  }

  private async loadCards(actor: OnSiteActor, now: Date, timezone: string | null): Promise<OnSiteCard[]> {
    const users = await this.prisma.user.findMany({
      where: {
        companyId: actor.companyId,
        assignedTickets: { some: { status: { in: ACTIVE_TICKET_STATUSES } } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        workShifts: {
          orderBy: { openedAt: 'desc' },
          take: 5,
          select: {
            status: true,
            lastLatitude: true,
            lastLongitude: true,
            lastGeoAt: true,
            openedAt: true,
          },
        },
        assignedTickets: {
          where: { status: { in: ACTIVE_TICKET_STATUSES } },
          orderBy: { ticketNumber: 'asc' },
          select: {
            id: true,
            ticketNumber: true,
            companyId: true,
            location: { select: { name: true, latitude: true, longitude: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    })
    if (users.length === 0) return []

    const arrivals = await this.prisma.technicianArrival.findMany({
      where: {
        companyId: actor.companyId,
        userId: { in: users.map((user) => user.id) },
        ticketId: { in: users.flatMap((user) => user.assignedTickets.map((ticket) => ticket.id)) },
      },
      select: {
        userId: true,
        ticketId: true,
        ...arrivalSelect,
      },
    })
    const byKey = new Map(arrivals.map((row) => [`${row.userId}:${row.ticketId}`, row]))
    return users.map((user) => toCard(user, byKey, now, timezone)).filter((card) => card.lines.length > 0)
  }
}

const arrivalSelect = {
  arrivedAt: true,
  departedAt: true,
  corrections: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: {
      createdAt: true,
      correctedArrivedAt: true,
      correctedDepartedAt: true,
    },
  },
  events: {
    where: { kind: { in: [TechnicianArrivalEventKind.ARRIVED, TechnicianArrivalEventKind.DEPARTED] } },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { createdAt: true },
  },
}

function toCard(
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    workShifts: ShiftRow[]
    assignedTickets: Array<{
      id: string
      ticketNumber: number
      companyId: string
      location: { name: string; latitude: number | null; longitude: number | null }
    }>
  },
  arrivals: Map<string, ArrivalRow>,
  now: Date,
  timezone: string | null,
): OnSiteCard {
  const shift = currentShift(user.workShifts)
  const shiftOpen = shift?.status === WorkShiftStatus.OPEN
  const lines = user.assignedTickets.map((ticket) => {
    const arrival = arrivals.get(`${user.id}:${ticket.id}`) ?? null
    return presentLine({ ticket, shift, shiftOpen, arrival, now, timezone })
  })
  return {
    userId: user.id,
    name: staffName(user),
    shiftOpen,
    lines,
  }
}

function currentShift(shifts: ShiftRow[]): ShiftRow | null {
  if (shifts.length === 0) return null
  return shifts.find((shift) => shift.status === WorkShiftStatus.OPEN) ?? shifts[0]
}

function presentLine(input: {
  ticket: {
    id: string
    ticketNumber: number
    companyId: string
    location: { name: string; latitude: number | null; longitude: number | null }
  }
  shift: ShiftRow | null
  shiftOpen: boolean
  arrival: ArrivalRow | null
  now: Date
  timezone: string | null
}): OnSiteLine {
  const facts = displayedFacts(
    input.arrival
      ? {
          arrivedAt: input.arrival.arrivedAt,
          departedAt: input.arrival.departedAt,
          lastAutoEventAt: input.arrival.events[0]?.createdAt ?? null,
          correction: input.arrival.corrections[0] ?? null,
        }
      : null,
  )
  const lastGeoAt = input.shift?.lastGeoAt ?? null
  const fresh = isFreshPoint(lastGeoAt, input.now)
  const hasLocationCoordinates =
    input.ticket.location.latitude != null && input.ticket.location.longitude != null
      ? Number.isFinite(input.ticket.location.latitude) && Number.isFinite(input.ticket.location.longitude)
      : false
  const distanceMeters = distanceToLocation(
    input.shift?.lastLatitude,
    input.shift?.lastLongitude,
    input.ticket.location.latitude,
    input.ticket.location.longitude,
  )
  const outcome = resolveOutcome({
    hasLocationCoordinates,
    arrivedAt: facts.arrivedAt,
    departedAt: facts.departedAt,
    fresh,
  })
  const label = outcomeLabel({
    outcome,
    arrivedAt: facts.arrivedAt,
    departedAt: facts.departedAt,
    distanceMeters,
    lastGeoAt,
    now: input.now,
    timezone: input.timezone,
  })
  const notes = lineNotes({
    outcome,
    fresh,
    shiftOpen: input.shiftOpen,
    lastGeoAt,
    timezone: input.timezone,
  })
  return {
    ticketId: input.ticket.id,
    ticketNumber: input.ticket.ticketNumber,
    locationName: input.ticket.location.name,
    linkedClientCompanyId: input.ticket.companyId,
    ticketHref: arrivalTicketHref(input.ticket.id, input.ticket.companyId),
    state: outcome,
    stateOrder: outcomeRank(outcome) + 1,
    label,
    notes,
    text: [label, ...notes].join(' '),
    distanceMeters,
    lastPointAt: lastGeoAt ? lastGeoAt.toISOString() : null,
    arrivedAt: facts.arrivedAt ? facts.arrivedAt.toISOString() : null,
    departedAt: facts.departedAt ? facts.departedAt.toISOString() : null,
  }
}

function parseListQuery(query: OnSiteListQuery): ParsedQuery {
  return {
    state: pick(query.state, ON_SITE_OUTCOMES, 'state'),
    shift: pick(query.shift, SHIFTS, 'shift'),
    technician: (query.technician || '').trim() || undefined,
    sort: pick(query.sort, SORTS, 'sort') ?? 'state',
  }
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], name: string): T | undefined {
  const trimmed = (value || '').trim()
  if (!trimmed) return undefined
  if ((allowed as readonly string[]).includes(trimmed)) return trimmed as T
  throw new BadRequestException(`Неизвестный параметр ${name}`)
}

function emptyReason(total: number, shown: number): 'no_assignments' | 'filtered_out' | null {
  if (shown > 0) return null
  return total === 0 ? 'no_assignments' : 'filtered_out'
}

function applyFilters(cards: OnSiteCard[], query: ParsedQuery): OnSiteCard[] {
  const needle = query.technician?.toLocaleLowerCase('ru')
  return cards
    .filter((card) => {
      if (query.shift === 'open' && !card.shiftOpen) return false
      if (query.shift === 'closed' && card.shiftOpen) return false
      if (needle && !card.name.toLocaleLowerCase('ru').includes(needle)) return false
      return true
    })
    .map((card) => {
      if (!query.state) return card
      return { ...card, lines: card.lines.filter((line) => line.state === query.state) }
    })
    .filter((card) => card.lines.length > 0)
}

function sortCards(cards: OnSiteCard[], sort: OnSiteSort): OnSiteCard[] {
  const next = cards.map((card) => ({ ...card, lines: sortLines(card.lines, sort) }))
  next.sort((left, right) => compareCards(left, right, sort))
  return next
}

function sortLines(lines: OnSiteLine[], sort: OnSiteSort): OnSiteLine[] {
  const next = [...lines]
  next.sort((left, right) => {
    if (sort === 'distance') {
      return compareNullableNumber(left.distanceMeters, right.distanceMeters) || left.ticketNumber - right.ticketNumber
    }
    return left.stateOrder - right.stateOrder || left.ticketNumber - right.ticketNumber
  })
  return next
}

function compareCards(left: OnSiteCard, right: OnSiteCard, sort: OnSiteSort): number {
  if (sort === 'name') return left.name.localeCompare(right.name, 'ru') || left.userId.localeCompare(right.userId)
  if (sort === 'lastPoint') {
    return compareTimeDesc(latestPoint(left), latestPoint(right)) || left.name.localeCompare(right.name, 'ru')
  }
  if (sort === 'distance') {
    return compareNullableNumber(nearestDistance(left), nearestDistance(right)) || left.name.localeCompare(right.name, 'ru')
  }
  const rank = Math.min(...left.lines.map((line) => line.stateOrder)) - Math.min(...right.lines.map((line) => line.stateOrder))
  return rank || left.name.localeCompare(right.name, 'ru')
}

function latestPoint(card: OnSiteCard): number | null {
  let best: number | null = null
  for (const line of card.lines) {
    if (!line.lastPointAt) continue
    const time = new Date(line.lastPointAt).getTime()
    if (best == null || time > best) best = time
  }
  return best
}

function nearestDistance(card: OnSiteCard): number | null {
  let best: number | null = null
  for (const line of card.lines) {
    if (line.distanceMeters == null) continue
    if (best == null || line.distanceMeters < best) best = line.distanceMeters
  }
  return best
}

function compareNullableNumber(left: number | null, right: number | null): number {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return left - right
}

function compareTimeDesc(left: number | null, right: number | null): number {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return right - left
}
