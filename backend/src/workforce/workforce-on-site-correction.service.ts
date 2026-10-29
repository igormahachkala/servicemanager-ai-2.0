import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { TechnicianArrivalEventKind, TicketStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { CreateArrivalCorrectionDto } from './dto/create-arrival-correction.dto'
import { OnSiteActor, requireProviderStaff } from './workforce-on-site-access'
import { staffName } from './workforce-on-site.rules'

const ACTIVE_TICKET_STATUSES = [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS]

@Injectable()
export class WorkforceOnSiteCorrectionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: OnSiteActor, ticketId: string, dto: CreateArrivalCorrectionDto) {
    await requireProviderStaff(this.prisma, actor)
    const reason = (dto.reason ?? '').trim()
    if (!reason) throw new BadRequestException('Укажите причину правки')

    const correctedArrivedAt = parseOptionalTime(dto.correctedArrivedAt)
    const correctedDepartedAt = parseOptionalTime(dto.correctedDepartedAt)
    const ticket = await this.findAssignment(actor, ticketId)

    return this.prisma.$transaction(async (tx) => {
      let arrival = await tx.technicianArrival.findUnique({
        where: { ticketId_userId: { ticketId: ticket.id, userId: ticket.assignedTechnicianId } },
      })
      if (!arrival) {
        arrival = await tx.technicianArrival.create({
          data: {
            companyId: actor.companyId,
            ticketId: ticket.id,
            userId: ticket.assignedTechnicianId,
            candidateStreak: 0,
          },
        })
      }

      const correction = await tx.technicianArrivalCorrection.create({
        data: {
          companyId: actor.companyId,
          arrivalId: arrival.id,
          correctedByUserId: actor.id,
          correctedArrivedAt,
          correctedDepartedAt,
          reason,
        },
      })
      await tx.technicianArrivalEvent.create({
        data: {
          companyId: actor.companyId,
          arrivalId: arrival.id,
          kind: TechnicianArrivalEventKind.CORRECTION,
          occurredAt: correction.createdAt,
          distanceMeters: arrival.lastDistanceMeters,
        },
      })
      return correction
    })
  }

  async list(actor: OnSiteActor, ticketId: string) {
    await requireProviderStaff(this.prisma, actor)
    const ticket = await this.findAssignment(actor, ticketId)
    const arrival = await this.prisma.technicianArrival.findUnique({
      where: { ticketId_userId: { ticketId: ticket.id, userId: ticket.assignedTechnicianId } },
      select: { id: true },
    })
    if (!arrival) return { ticketId: ticket.id, userId: ticket.assignedTechnicianId, items: [] }

    const rows = await this.prisma.technicianArrivalCorrection.findMany({
      where: { arrivalId: arrival.id, companyId: actor.companyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reason: true,
        correctedArrivedAt: true,
        correctedDepartedAt: true,
        createdAt: true,
        correctedByUserId: true,
        correctedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    })
    return {
      ticketId: ticket.id,
      userId: ticket.assignedTechnicianId,
      items: rows.map((row) => ({
        id: row.id,
        reason: row.reason,
        correctedArrivedAt: row.correctedArrivedAt,
        correctedDepartedAt: row.correctedDepartedAt,
        createdAt: row.createdAt,
        correctedByUserId: row.correctedByUserId,
        correctedByName: staffName(row.correctedBy),
      })),
    }
  }

  private async findAssignment(actor: OnSiteActor, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        status: { in: ACTIVE_TICKET_STATUSES },
        assignedTechnician: { companyId: actor.companyId },
      },
      select: {
        id: true,
        companyId: true,
        status: true,
        assignedTechnicianId: true,
      },
    })
    if (!ticket?.assignedTechnicianId) throw new NotFoundException('Назначение не найдено')
    return { ...ticket, assignedTechnicianId: ticket.assignedTechnicianId }
  }
}

function parseOptionalTime(value: string | null | undefined): Date | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Некорректное время')
  return date
}
