import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { TicketSource, TicketStatus, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { isPlatformObserverScope, resolveObserverScopeCompanyId } from '../policy/policy.utils'
import { resolveActorLocationScope } from '../tickets/ticket-access.utils'
import { EXECUTOR_CAPABLE_ROLES } from '../common/executor.utils'

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  private async resolveScopedTicketWhere(actorCompanyId: string, actorUserId: string, actorRole: UserRole, scopeCompanyId: string) {
    const locationScope = await resolveActorLocationScope({
      prisma: this.prisma,
      actor: {
        id: actorUserId,
        role: actorRole,
        companyId: actorCompanyId,
      },
      scopeCompanyId,
    })

    return {
      companyId: scopeCompanyId,
      ...(locationScope.mode === 'bound_locations'
        ? { locationId: { in: locationScope.locationIds } }
        : {}),
    }
  }

  async getCategoriesAnalytics(companyId: string, actorUserId: string, actorRole: UserRole) {
    const ticketWhere = await this.resolveScopedTicketWhere(companyId, actorUserId, actorRole, companyId)
    const categories = await this.prisma.problemCategory.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const grouped = await this.prisma.ticket.groupBy({
      by: ['problemCategoryId', 'status'],
      where: ticketWhere,
      _count: { _all: true },
    })

    const statusToCountByCategory = new Map<string, Map<string, number>>()
    for (const row of grouped) {
      const byStatus = statusToCountByCategory.get(row.problemCategoryId) ?? new Map<string, number>()
      byStatus.set(row.status, row._count._all)
      statusToCountByCategory.set(row.problemCategoryId, byStatus)
    }

    const activeInProgressStatuses = this.resolveInProgressStatuses()
    const doneStatuses = this.resolveDoneStatuses()

    return categories.map((category) => {
      const byStatus = statusToCountByCategory.get(category.id) ?? new Map<string, number>()
      const total = Array.from(byStatus.values()).reduce((sum, value) => sum + value, 0)
      const newCount = byStatus.get(TicketStatus.NEW) ?? 0
      const inProgress = activeInProgressStatuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0)
      const done = doneStatuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0)
      return {
        categoryId: category.id,
        name: category.name,
        total,
        new: newCount,
        inProgress,
        done,
      }
    })
  }

  async getSpecializationsAnalytics(companyId: string, actorUserId: string, actorRole: UserRole) {
    const ticketWhere = await this.resolveScopedTicketWhere(companyId, actorUserId, actorRole, companyId)
    const specializations = await this.prisma.specialization.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const [categoryLinks, ticketsGrouped, technicianLinks] = await Promise.all([
      this.prisma.problemCategorySpecialization.findMany({
        where: { specialization: { companyId } },
        select: { specializationId: true, problemCategoryId: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['problemCategoryId'],
        where: ticketWhere,
        _count: { _all: true },
      }),
      this.prisma.technicianSpecialization.findMany({
        where: {
          specialization: { companyId },
          user: { companyId, isExecutor: true, role: { in: Array.from(EXECUTOR_CAPABLE_ROLES) }, isActive: true },
        },
        select: { specializationId: true, userId: true },
      }),
    ])

    const ticketsByCategory = new Map<string, number>()
    for (const row of ticketsGrouped) {
      ticketsByCategory.set(row.problemCategoryId, row._count._all)
    }

    const categoriesBySpecialization = new Map<string, Set<string>>()
    for (const link of categoryLinks) {
      const set = categoriesBySpecialization.get(link.specializationId) ?? new Set<string>()
      set.add(link.problemCategoryId)
      categoriesBySpecialization.set(link.specializationId, set)
    }

    const techniciansBySpecialization = new Map<string, Set<string>>()
    for (const link of technicianLinks) {
      const set = techniciansBySpecialization.get(link.specializationId) ?? new Set<string>()
      set.add(link.userId)
      techniciansBySpecialization.set(link.specializationId, set)
    }

    return specializations.map((specialization) => {
      const categoriesSet = categoriesBySpecialization.get(specialization.id) ?? new Set<string>()
      let tickets = 0
      for (const categoryId of categoriesSet) {
        tickets += ticketsByCategory.get(categoryId) ?? 0
      }
      const technicians = (techniciansBySpecialization.get(specialization.id) ?? new Set<string>()).size
      return {
        specializationId: specialization.id,
        name: specialization.name,
        tickets,
        technicians,
      }
    })
  }

  async getWorkloadAnalytics(companyId: string, actorUserId: string, actorRole: UserRole) {
    const ticketWhere = await this.resolveScopedTicketWhere(companyId, actorUserId, actorRole, companyId)
    const categories = await this.prisma.problemCategory.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const openStatuses = this.resolveOpenStatuses()
    const [categoryLinks, openTicketsGrouped, technicianLinks] = await Promise.all([
      this.prisma.problemCategorySpecialization.findMany({
        where: { specialization: { companyId } },
        select: {
          problemCategoryId: true,
          specializationId: true,
          specialization: { select: { name: true } },
        },
      }),
      this.prisma.ticket.groupBy({
        by: ['problemCategoryId'],
        where: { ...ticketWhere, status: { in: openStatuses } },
        _count: { _all: true },
      }),
      this.prisma.technicianSpecialization.findMany({
        where: {
          specialization: { companyId },
          user: { companyId, isExecutor: true, role: { in: Array.from(EXECUTOR_CAPABLE_ROLES) }, isActive: true },
        },
        select: { specializationId: true, userId: true },
      }),
    ])

    const openTicketsByCategory = new Map<string, number>()
    for (const row of openTicketsGrouped) {
      openTicketsByCategory.set(row.problemCategoryId, row._count._all)
    }

    const specializationNamesByCategory = new Map<string, string[]>()
    const specializationIdsByCategory = new Map<string, Set<string>>()
    for (const link of categoryLinks) {
      const ids = specializationIdsByCategory.get(link.problemCategoryId) ?? new Set<string>()
      ids.add(link.specializationId)
      specializationIdsByCategory.set(link.problemCategoryId, ids)

      const names = specializationNamesByCategory.get(link.problemCategoryId) ?? []
      if (!names.includes(link.specialization.name)) names.push(link.specialization.name)
      specializationNamesByCategory.set(link.problemCategoryId, names)
    }

    const technicianIdsBySpecialization = new Map<string, Set<string>>()
    for (const link of technicianLinks) {
      const set = technicianIdsBySpecialization.get(link.specializationId) ?? new Set<string>()
      set.add(link.userId)
      technicianIdsBySpecialization.set(link.specializationId, set)
    }

    return categories.map((category) => {
      const requiredSpecializations = (specializationNamesByCategory.get(category.id) ?? []).slice().sort((a, b) => a.localeCompare(b))
      const specializationIds = specializationIdsByCategory.get(category.id) ?? new Set<string>()

      // NOTE: This is an analytics approximation, not real-time dispatch availability.
      // We count active technicians in tenant who have at least one required specialization.
      const availableTechIds = new Set<string>()
      for (const specializationId of specializationIds) {
        const techIds = technicianIdsBySpecialization.get(specializationId)
        if (!techIds) continue
        for (const userId of techIds) availableTechIds.add(userId)
      }

      return {
        category: category.name,
        requiredSpecializations,
        openTickets: openTicketsByCategory.get(category.id) ?? 0,
        availableTechnicians: availableTechIds.size,
      }
    })
  }

  async overview(actorCompanyId: string, actorUserId: string, actorRole: UserRole, companyId?: string, linkedClientCompanyId?: string) {
    const scope = await this.resolveScope(actorCompanyId, actorRole, companyId, linkedClientCompanyId)
    const scopeCompanyId = scope.scopeCompanyId
    const ticketWhere = await this.resolveScopedTicketWhere(actorCompanyId, actorUserId, actorRole, scopeCompanyId)
    const now = new Date()
    const TICKETS_LIMIT = 2000

    const createdCount = await this.prisma.ticket.count({ where: ticketWhere })

    const openByStatusGrouped = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: {
        ...ticketWhere,
        status: { in: [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
      },
      _count: { _all: true },
    })

    const openByStatus = { NEW: 0, ASSIGNED: 0, IN_PROGRESS: 0 }
    for (const row of openByStatusGrouped) {
      if (row.status === TicketStatus.NEW) openByStatus.NEW = row._count._all
      if (row.status === TicketStatus.ASSIGNED) openByStatus.ASSIGNED = row._count._all
      if (row.status === TicketStatus.IN_PROGRESS) openByStatus.IN_PROGRESS = row._count._all
    }

    const backlogOpenTotal = openByStatus.NEW + openByStatus.ASSIGNED + openByStatus.IN_PROGRESS

    const unassignedOpenTickets = await this.prisma.ticket.count({
      where: {
        ...ticketWhere,
        status: { in: [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
        assignedTechnicianId: null,
      },
    })

    const slaEvaluatedCount = await this.prisma.ticket.count({
      where: { ...ticketWhere, slaDueAt: { not: null } },
    })

    const slaBreachedCount = await this.prisma.ticket.count({
      where: { ...ticketWhere, slaBreachedAt: { not: null } },
    })

    const slaOkCount = Math.max(slaEvaluatedCount - slaBreachedCount, 0)
    const okPercent = slaEvaluatedCount > 0 ? Math.round((slaOkCount / slaEvaluatedCount) * 10000) / 100 : 0
    const breachedPercent = slaEvaluatedCount > 0 ? Math.round((slaBreachedCount / slaEvaluatedCount) * 10000) / 100 : 0

    const tickets = await this.prisma.ticket.findMany({
      where: ticketWhere,
      select: {
        id: true,
        createdAt: true,
        assignedTechnicianId: true,
        status: true,
        source: true,
        publicRequestType: true,
        locationId: true,
        equipmentId: true,
        location: { select: { id: true, name: true, city: true } },
        equipment: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: TICKETS_LIMIT,
    })

    const ticketIds = tickets.map((t) => t.id)
    const createdAtById = new Map<string, Date>()
    for (const t of tickets) createdAtById.set(t.id, t.createdAt)

    const technicians = await this.prisma.user.findMany({
      where: { companyId: scopeCompanyId, role: 'TECHNICIAN' },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    })

    const technicianEmailById = new Map<string, string>()
    for (const tech of technicians) technicianEmailById.set(tech.id, tech.email)

    if (ticketIds.length === 0) {
      return {
        createdCount,
        openByStatus,
        bySource: { INTERNAL: 0, PUBLIC_QUICK_REQUEST: 0 },
        publicIntake: {
          total: 0,
          resolved: 0,
          resolvedPercent: 0,
          byType: { REPAIR: 0, NOTE: 0 },
          byDay: [],
          byLocation: [],
          byEquipment: [],
        },
        summary: { backlogOpenTotal, unassignedOpenTickets },
        sla: { evaluatedCount: slaEvaluatedCount, breachedCount: slaBreachedCount, okPercent, breachedPercent },
        timing: {
          evaluatedTickets: 0,
          meanTimeToAssignMinutes: 0,
          meanTimeToResolveMinutes: 0,
          note: 'No tickets available for timing metrics',
        },
        workloadByTechnician: [],
        throughputByTechnician: [],
        note: 'overview v7 (platform observer + provider relationship aware + public intake slices)',
        now,
        meta: { scopeCompanyId, visibilityMode: scope.visibilityMode },
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
        ...ticketWhere,
        status: { in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
        assignedTechnicianId: { not: null },
      },
      select: { assignedTechnicianId: true, status: true },
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

    const bySource = { INTERNAL: 0, PUBLIC_QUICK_REQUEST: 0 }
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
        byDay: Array.from(publicByDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([day, total]) => ({ day, total })),
        byLocation: Array.from(publicByLocation.values()).sort((a, b) => b.total - a.total),
        byEquipment: Array.from(publicByEquipment.values()).sort((a, b) => b.total - a.total),
      },
      summary: { backlogOpenTotal, unassignedOpenTickets },
      sla: { evaluatedCount: slaEvaluatedCount, breachedCount: slaBreachedCount, okPercent, breachedPercent },
      timing: {
        evaluatedTickets: ticketIds.length,
        meanTimeToAssignMinutes,
        meanTimeToResolveMinutes,
        note: 'Mean times computed from ticket.createdAt to first assignment/claim and DONE timeline events over last N tickets',
      },
      workloadByTechnician,
      throughputByTechnician,
      now,
      meta: { scopeCompanyId, visibilityMode: scope.visibilityMode },
      note: 'overview v7 (counts + backlog + sla percent + workload + throughput + public intake analytics + relationship-aware provider scope + platform observer)',
    }
  }

  private async resolveScope(actorCompanyId: string, actorRole: UserRole, companyId?: string, linkedClientCompanyId?: string) {
    const observerCompanyId = resolveObserverScopeCompanyId({
      actorCompanyId,
      actorRole,
      requestedCompanyId: companyId,
    })

    if (isPlatformObserverScope({ actorCompanyId, actorRole, scopeCompanyId: observerCompanyId })) {
      const company = await this.prisma.company.findUnique({
        where: { id: observerCompanyId },
        select: { id: true },
      })

      if (!company) {
        throw new NotFoundException('Company not found')
      }

      return { scopeCompanyId: observerCompanyId, visibilityMode: 'platform_observer' as const }
    }

    if (!linkedClientCompanyId || linkedClientCompanyId === actorCompanyId) {
      return { scopeCompanyId: actorCompanyId, visibilityMode: 'tenant' as const }
    }

    const access = await this.serviceContractsService.getLinkedClientAccess(actorCompanyId, linkedClientCompanyId)
    if (!access) {
      throw new BadRequestException('Linked client analytics is not available')
    }

    if (access.role !== 'PRIMARY') {
      throw new BadRequestException('Linked client analytics is available only for PRIMARY provider')
    }

    return { scopeCompanyId: linkedClientCompanyId, visibilityMode: 'provider_primary' as const }
  }

  private hasStatus(status: string) {
    return (Object.values(TicketStatus) as string[]).includes(status)
  }

  private resolveInProgressStatuses() {
    const statuses: TicketStatus[] = [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS]
    if (this.hasStatus('ON_HOLD')) statuses.push('ON_HOLD' as TicketStatus)
    return statuses
  }

  private resolveDoneStatuses() {
    const statuses: TicketStatus[] = [TicketStatus.DONE]
    if (this.hasStatus('CLOSED')) statuses.push('CLOSED' as TicketStatus)
    return statuses
  }

  private resolveOpenStatuses() {
    const statuses: TicketStatus[] = [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS]
    if (this.hasStatus('ON_HOLD')) statuses.push('ON_HOLD' as TicketStatus)
    return statuses
  }
}