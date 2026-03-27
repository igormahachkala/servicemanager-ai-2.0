import { BadRequestException, Injectable } from '@nestjs/common'
import { TicketSource, TicketStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async overview(companyId: string, linkedClientCompanyId?: string) {
    const scopeCompanyId = await this.resolveScopeCompanyId(companyId, linkedClientCompanyId)
    const now = new Date()
    const TICKETS_LIMIT = 2000

    const createdCount = await this.prisma.ticket.count({
      where: { companyId: scopeCompanyId },
    })

    const openByStatusGrouped = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: {
        companyId: scopeCompanyId,
        status: {
          in: [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
        },
      },
      _count: { _all: true },
    })

    const openByStatus = {
      NEW: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
    }

    for (const row of openByStatusGrouped) {
      if (row.status === TicketStatus.NEW) openByStatus.NEW = row._count._all
      if (row.status === TicketStatus.ASSIGNED) openByStatus.ASSIGNED = row._count._all
      if (row.status === TicketStatus.IN_PROGRESS) openByStatus.IN_PROGRESS = row._count._all
    }

    const backlogOpenTotal = openByStatus.NEW + openByStatus.ASSIGNED + openByStatus.IN_PROGRESS

    const unassignedOpenTickets = await this.prisma.ticket.count({
      where: {
        companyId: scopeCompanyId,
        status: {
          in: [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
        },
        assignedTechnicianId: null,
      },
    })

    const slaEvaluatedCount = await this.prisma.ticket.count({
      where: {
        companyId: scopeCompanyId,
        slaDueAt: { not: null },
      },
    })

    const slaBreachedCount = await this.prisma.ticket.count({
      where: {
        companyId: scopeCompanyId,
        slaBreachedAt: { not: null },
      },
    })

    const slaOkCount = Math.max(slaEvaluatedCount - slaBreachedCount, 0)
    const okPercent = slaEvaluatedCount > 0 ? Math.round((slaOkCount / slaEvaluatedCount) * 10000) / 100 : 0
    const breachedPercent = slaEvaluatedCount > 0 ? Math.round((slaBreachedCount / slaEvaluatedCount) * 10000) / 100 : 0

    const tickets = await this.prisma.ticket.findMany({
      where: { companyId: scopeCompanyId },
      select: {
        id: true,
        createdAt: true,
        assignedTechnicianId: true,
        status: true,
        source: true,
        publicRequestType: true,
        locationId: true,
        equipmentId: true,
        location: {
          select: { id: true, name: true, city: true },
        },
        equipment: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: TICKETS_LIMIT,
    })

    const ticketIds = tickets.map((t) => t.id)
    const createdAtById = new Map<string, Date>()
    for (const t of tickets) createdAtById.set(t.id, t.createdAt)

    const technicians = await this.prisma.user.findMany({
      where: {
        companyId: scopeCompanyId,
        role: 'TECHNICIAN',
      },
      select: {
        id: true,
        email: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const technicianEmailById = new Map<string, string>()
    for (const tech of technicians) technicianEmailById.set(tech.id, tech.email)

    if (ticketIds.length === 0) {
      return {
        createdCount,
        openByStatus,
        bySource: {
          INTERNAL: 0,
          PUBLIC_QUICK_REQUEST: 0,
        },
        publicIntake: {
          total: 0,
          resolved: 0,
          resolvedPercent: 0,
          byType: { REPAIR: 0, NOTE: 0 },
          byDay: [],
          byLocation: [],
          byEquipment: [],
        },
        summary: {
          backlogOpenTotal,
          unassignedOpenTickets,
        },
        sla: {
          evaluatedCount: slaEvaluatedCount,
          breachedCount: slaBreachedCount,
          okPercent,
          breachedPercent,
        },
        timing: {
          evaluatedTickets: 0,
          meanTimeToAssignMinutes: 0,
          meanTimeToResolveMinutes: 0,
          note: 'No tickets available for timing metrics',
        },
        workloadByTechnician: [],
        throughputByTechnician: [],
        note: 'overview v6 (relationship-aware + public intake slices)',
        now,
        meta: {
          scopeCompanyId,
          visibilityMode: scopeCompanyId === companyId ? 'tenant' : 'provider_primary',
        },
      }
    }

    const timelineEvents = await this.timelineService.listTicketEvents(scopeCompanyId, ticketIds)
    const firstAssignedAt = new Map<string, Date>()
    const firstDoneAt = new Map<string, Date>()

    for (const event of timelineEvents) {
      if ((event.timelineEvent === 'TICKET_ASSIGNED' || event.timelineEvent === 'TICKET_CLAIMED') && !firstAssignedAt.has(event.ticketId)) {
        firstAssignedAt.set(event.ticketId, event.at)
      }

      const payload = event.payload as { toStatus?: TicketStatus } | null
      if (event.timelineEvent === 'STATUS_CHANGED' && payload?.toStatus === TicketStatus.DONE && !firstDoneAt.has(event.ticketId)) {
        firstDoneAt.set(event.ticketId, event.at)
      }
    }

    let assignSum = 0
    let assignN = 0
    let resolveSum = 0
    let resolveN = 0

    for (const id of ticketIds) {
      const createdAt = createdAtById.get(id)
      if (!createdAt) continue

      const assignedAt = firstAssignedAt.get(id)
      if (assignedAt && assignedAt.getTime() > createdAt.getTime()) {
        assignSum += (assignedAt.getTime() - createdAt.getTime()) / 60000
        assignN += 1
      }

      const doneAt = firstDoneAt.get(id)
      if (doneAt && doneAt.getTime() > createdAt.getTime()) {
        resolveSum += (doneAt.getTime() - createdAt.getTime()) / 60000
        resolveN += 1
      }
    }

    const meanTimeToAssignMinutes = assignN > 0 ? Math.round((assignSum / assignN) * 100) / 100 : 0
    const meanTimeToResolveMinutes = resolveN > 0 ? Math.round((resolveSum / resolveN) * 100) / 100 : 0

    const openTicketsWithAssignee = await this.prisma.ticket.findMany({
      where: {
        companyId: scopeCompanyId,
        status: {
          in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
        },
        assignedTechnicianId: { not: null },
      },
      select: {
        assignedTechnicianId: true,
        status: true,
      },
    })

    const workloadMap = new Map<string, { technicianId: string; technicianEmail: string; assignedCount: number; inProgressCount: number; activeCount: number }>()
    for (const row of openTicketsWithAssignee) {
      const technicianId = row.assignedTechnicianId
      if (!technicianId) continue

      const existing = workloadMap.get(technicianId) ?? {
        technicianId,
        technicianEmail: technicianEmailById.get(technicianId) ?? technicianId,
        assignedCount: 0,
        inProgressCount: 0,
        activeCount: 0,
      }

      if (row.status === TicketStatus.ASSIGNED) existing.assignedCount += 1
      if (row.status === TicketStatus.IN_PROGRESS) existing.inProgressCount += 1
      existing.activeCount += 1
      workloadMap.set(technicianId, existing)
    }

    const workloadByTechnician = Array.from(workloadMap.values()).sort((a, b) => {
      if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount
      return a.technicianEmail.localeCompare(b.technicianEmail)
    })

    const doneByTech = new Map<string, number>()
    for (const t of tickets) {
      if (t.status !== TicketStatus.DONE || !t.assignedTechnicianId) continue
      doneByTech.set(t.assignedTechnicianId, (doneByTech.get(t.assignedTechnicianId) ?? 0) + 1)
    }

    const throughputByTechnician = Array.from(doneByTech.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([technicianId, doneCount]) => ({
        technicianId,
        technicianEmail: technicianEmailById.get(technicianId) ?? technicianId,
        doneCount,
      }))

    const bySource = {
      INTERNAL: 0,
      PUBLIC_QUICK_REQUEST: 0,
    }

    const publicByType = { REPAIR: 0, NOTE: 0 }
    const publicByDay = new Map<string, number>()
    const publicByLocation = new Map<string, { locationId: string; locationName: string; city: string | null; total: number; repairCount: number; noteCount: number; resolvedCount: number }>()
    const publicByEquipment = new Map<string, { equipmentId: string; name: string; type: string; total: number }>()

    let publicTotal = 0
    let publicResolved = 0

    for (const ticket of tickets) {
      if (ticket.source === TicketSource.PUBLIC_QUICK_REQUEST) {
        bySource.PUBLIC_QUICK_REQUEST += 1
        publicTotal += 1
        if (ticket.status === TicketStatus.DONE) publicResolved += 1

        if (ticket.publicRequestType === 'REPAIR') publicByType.REPAIR += 1
        if (ticket.publicRequestType === 'NOTE') publicByType.NOTE += 1

        const day = ticket.createdAt.toISOString().slice(0, 10)
        publicByDay.set(day, (publicByDay.get(day) ?? 0) + 1)

        const locationEntry = publicByLocation.get(ticket.locationId) ?? {
          locationId: ticket.locationId,
          locationName: ticket.location?.name || ticket.locationId,
          city: ticket.location?.city || null,
          total: 0,
          repairCount: 0,
          noteCount: 0,
          resolvedCount: 0,
        }
        locationEntry.total += 1
        if (ticket.publicRequestType === 'REPAIR') locationEntry.repairCount += 1
        if (ticket.publicRequestType === 'NOTE') locationEntry.noteCount += 1
        if (ticket.status === TicketStatus.DONE) locationEntry.resolvedCount += 1
        publicByLocation.set(ticket.locationId, locationEntry)

        if (ticket.equipmentId && ticket.equipment) {
          const equipmentEntry = publicByEquipment.get(ticket.equipmentId) ?? {
            equipmentId: ticket.equipmentId,
            name: ticket.equipment.name,
            type: ticket.equipment.type,
            total: 0,
          }
          equipmentEntry.total += 1
          publicByEquipment.set(ticket.equipmentId, equipmentEntry)
        }
      } else {
        bySource.INTERNAL += 1
      }
    }

    return {
      createdCount,
      openByStatus,
      bySource,
      publicIntake: {
        total: publicTotal,
        resolved: publicResolved,
        resolvedPercent: publicTotal > 0 ? Math.round((publicResolved / publicTotal) * 10000) / 100 : 0,
        byType: publicByType,
        byDay: Array.from(publicByDay.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([day, total]) => ({ day, total })),
        byLocation: Array.from(publicByLocation.values()).sort((a, b) => b.total - a.total),
        byEquipment: Array.from(publicByEquipment.values()).sort((a, b) => b.total - a.total),
      },
      summary: {
        backlogOpenTotal,
        unassignedOpenTickets,
      },
      sla: {
        evaluatedCount: slaEvaluatedCount,
        breachedCount: slaBreachedCount,
        okPercent,
        breachedPercent,
      },
      timing: {
        evaluatedTickets: ticketIds.length,
        meanTimeToAssignMinutes,
        meanTimeToResolveMinutes,
        note: 'Mean times computed from ticket.createdAt to first assignment/claim and DONE timeline events over last N tickets',
      },
      workloadByTechnician,
      throughputByTechnician,
      now,
      meta: {
        scopeCompanyId,
        visibilityMode: scopeCompanyId === companyId ? 'tenant' : 'provider_primary',
      },
      note: 'overview v6 (counts + backlog + sla percent + workload + throughput + public intake analytics + relationship-aware provider scope)',
    }
  }

  private async resolveScopeCompanyId(companyId: string, linkedClientCompanyId?: string) {
    if (!linkedClientCompanyId || linkedClientCompanyId === companyId) {
      return companyId
    }

    const access = await this.serviceContractsService.getLinkedClientAccess(companyId, linkedClientCompanyId)
    if (!access) {
      throw new BadRequestException('Linked client analytics is not available')
    }

    if (access.role !== 'PRIMARY') {
      throw new BadRequestException('Linked client analytics is available only for PRIMARY provider')
    }

    return linkedClientCompanyId
  }
}
