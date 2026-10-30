import { Injectable } from '@nestjs/common'
import { TicketStatus, UserRole, WorkShiftStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { requireProviderStaff, type OnSiteActor } from './workforce-on-site-access'
import { providerTimeZone } from './workforce-on-site.rules'

export type TechnicianMapPerson = {
  id: string
  firstName: string | null
  lastName: string | null
  latitude: number | null
  longitude: number | null
  syncedAtLabel: string
}

export type TechnicianMapTicket = {
  id: string
  ticketNumber: number
  title: string
  technicianId: string
}

export type TechnicianMapResponse = {
  people: TechnicianMapPerson[]
  tickets: TechnicianMapTicket[]
}

const ACTIVE_TICKET_STATUSES = [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS]

export function formatTechnicianMapSyncLabel(date: Date, timezone?: string | null): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: providerTimeZone(timezone),
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`
}

@Injectable()
export class WorkforceTechnicianMapService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: OnSiteActor): Promise<TechnicianMapResponse> {
    const { timezone } = await requireProviderStaff(this.prisma, actor)
    const shifts = await this.prisma.workShift.findMany({
      where: {
        companyId: actor.companyId,
        status: WorkShiftStatus.OPEN,
        user: { role: UserRole.TECHNICIAN },
      },
      select: {
        userId: true,
        lastLatitude: true,
        lastLongitude: true,
        lastGeoAt: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    const people = shifts
      .map((shift) => this.toPerson(shift, timezone))
      .sort((left, right) => {
        const byLast = (left.lastName || '').localeCompare(right.lastName || '', 'ru')
        if (byLast !== 0) return byLast
        return (left.firstName || '').localeCompare(right.firstName || '', 'ru')
      })
    const technicianIds = people.map((person) => person.id)
    if (technicianIds.length === 0) return { people, tickets: [] }

    const tickets = await this.prisma.ticket.findMany({
      where: {
        assignedTechnicianId: { in: technicianIds },
        status: { in: ACTIVE_TICKET_STATUSES },
      },
      select: {
        id: true,
        ticketNumber: true,
        problemText: true,
        assignedTechnicianId: true,
      },
      orderBy: { ticketNumber: 'asc' },
    })

    return {
      people,
      tickets: tickets.flatMap((ticket) => {
        if (!ticket.assignedTechnicianId) return []
        return [{
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.problemText,
          technicianId: ticket.assignedTechnicianId,
        }]
      }),
    }
  }

  private toPerson(
    shift: {
      lastLatitude: number | null
      lastLongitude: number | null
      lastGeoAt: Date | null
      user: { id: string; firstName: string | null; lastName: string | null }
    },
    timezone: string | null,
  ): TechnicianMapPerson {
    const hasPoint = shift.lastLatitude != null && shift.lastLongitude != null && shift.lastGeoAt != null
    return {
      id: shift.user.id,
      firstName: shift.user.firstName,
      lastName: shift.user.lastName,
      latitude: hasPoint ? shift.lastLatitude : null,
      longitude: hasPoint ? shift.lastLongitude : null,
      syncedAtLabel: hasPoint && shift.lastGeoAt ? formatTechnicianMapSyncLabel(shift.lastGeoAt, timezone) : '',
    }
  }
}
