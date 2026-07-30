import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CompanyType, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { resolveObserverScopeCompanyId } from '../policy/policy.utils'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { resolveActorLocationScope } from '../tickets/ticket-access.utils'

type ListInput = {
  q?: string
  city?: string
  isActive?: string
}

@Injectable()
export class LocationsService {
  private readonly clientLeadershipRoles = new Set<UserRole>([UserRole.ADMIN, UserRole.NETWORK_DIRECTOR])

  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async list(actorCompanyId: string, actorRole: UserRole, actorUserId: string, input: ListInput & { includeDeleted?: boolean }, requestedCompanyId?: string) {
    const companyId = await this.resolveReadableCompanyId(actorCompanyId, actorRole, requestedCompanyId)
    const locationScope = await this.resolveLocationScope(actorCompanyId, actorRole, actorUserId, companyId)
    const q = input.q?.trim()
    const city = input.city?.trim()

    let isActiveFilter: boolean | undefined
    if (input.isActive !== undefined) {
      if (input.isActive === 'true') isActiveFilter = true
      else if (input.isActive === 'false') isActiveFilter = false
      else throw new BadRequestException('isActive must be true or false')
    }

    return this.prisma.location.findMany({
      where: {
        clientCompanyId: companyId,
        ...(input.includeDeleted ? {} : { deletedAt: null }),
        ...(locationScope.mode === 'bound_locations'
          ? { id: { in: locationScope.locationIds } }
          : {}),
        ...(typeof isActiveFilter === 'boolean' ? { isActive: isActiveFilter } : {}),
        ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { platformCode: { contains: q, mode: 'insensitive' } },
                { externalCode: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
                { region: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        clientCompanyId: true,
        name: true,
        platformCode: true,
        externalCode: true,
        city: true,
        region: true,
        address: true,
        latitude: true,
        longitude: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    })
  }

  async getOne(actorCompanyId: string, actorRole: UserRole, actorUserId: string, id: string, requestedCompanyId?: string) {
    const companyId = await this.resolveReadableCompanyId(actorCompanyId, actorRole, requestedCompanyId)
    const locationScope = await this.resolveLocationScope(actorCompanyId, actorRole, actorUserId, companyId)
    const location = await this.prisma.location.findFirst({
      where: {
        id,
        clientCompanyId: companyId,
        ...(locationScope.mode === 'bound_locations'
          ? { id: { in: locationScope.locationIds } }
          : {}),
      },
      select: this.locationSelect(),
    })

    if (!location) {
      throw new NotFoundException('Location not found')
    }

    return location
  }

  async create(
    actorCompanyId: string,
    actorRole: UserRole,
    dto: {
      name: string
      platformCode: string
      externalCode?: string
      city?: string
      region?: string
      address?: string
      latitude?: number
      longitude?: number
      isActive?: boolean
    },
    requestedCompanyId?: string,
  ) {
    // SMA-P0-CREATE-TICKET-DATA-CONSISTENCY-001: resolve the CLIENT owner the same way reads do, so a
    // provider acting in a linked-client scope creates a CLIENT-owned location (not provider-owned).
    // Reusing resolveReadableCompanyId asserts the provider↔client ServiceContract; the explicit
    // CLIENT guard below also rejects a provider creating without a client scope (early-return path).
    const companyId = await this.resolveReadableCompanyId(actorCompanyId, actorRole, requestedCompanyId)
    const owner = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { type: true },
    })
    if (!owner || owner.type !== CompanyType.CLIENT) {
      throw new BadRequestException(
        'Location owner must be a CLIENT company. Provide a linked client company via companyId.',
      )
    }

    const name = dto.name.trim()
    const platformCode = dto.platformCode.trim().toUpperCase()
    const externalCode = dto.externalCode?.trim() || null
    const city = dto.city?.trim() || null
    const region = dto.region?.trim() || null
    const address = dto.address?.trim() || null

    if (!name) {
      throw new BadRequestException('name is required')
    }

    if (!platformCode) {
      throw new BadRequestException('platformCode is required')
    }

    const exists = await this.prisma.location.findFirst({
      where: {
        clientCompanyId: companyId,
        platformCode,
      },
      select: { id: true },
    })

    if (exists) {
      throw new BadRequestException('Location with this platformCode already exists')
    }

    return this.prisma.location.create({
      data: {
        clientCompanyId: companyId,
        name,
        platformCode,
        externalCode,
        city,
        region,
        address,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isActive: dto.isActive ?? true,
      },
      select: this.locationSelect(),
    })
  }

  async update(
    companyId: string,
    id: string,
    dto: {
      name?: string
      platformCode?: string
      externalCode?: string | null
      city?: string | null
      region?: string | null
      address?: string | null
      latitude?: number | null
      longitude?: number | null
      isActive?: boolean
    },
  ) {
    const current = await this.prisma.location.findFirst({
      where: {
        id,
        clientCompanyId: companyId,
      },
      select: {
        id: true,
        platformCode: true,
      },
    })

    if (!current) {
      throw new NotFoundException('Location not found')
    }

    const nextPlatformCode =
      dto.platformCode !== undefined ? dto.platformCode.trim().toUpperCase() : undefined

    if (nextPlatformCode !== undefined) {
      if (!nextPlatformCode) {
        throw new BadRequestException('platformCode cannot be empty')
      }

      const duplicate = await this.prisma.location.findFirst({
        where: {
          clientCompanyId: companyId,
          platformCode: nextPlatformCode,
          NOT: { id },
        },
        select: { id: true },
      })

      if (duplicate) {
        throw new BadRequestException('Location with this platformCode already exists')
      }
    }

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('name cannot be empty')
    }

    return this.prisma.location.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(nextPlatformCode !== undefined ? { platformCode: nextPlatformCode } : {}),
        ...(dto.externalCode !== undefined ? { externalCode: dto.externalCode?.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.region !== undefined ? { region: dto.region?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: this.locationSelect(),
    })
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await this.ensureExists(companyId, id)

    return this.prisma.location.update({
      where: { id },
      data: { isActive },
      select: this.locationSelect(),
    })
  }

  async softDelete(companyId: string, id: string) {
    await this.ensureExists(companyId, id)

    return this.prisma.location.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
      select: this.locationSelect(),
    })
  }

  async restore(companyId: string, id: string) {
    const existing = await this.prisma.location.findFirst({
      where: { id, clientCompanyId: companyId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Location not found')

    return this.prisma.location.update({
      where: { id },
      data: { isActive: true, deletedAt: null },
      select: this.locationSelect(),
    })
  }

  private locationSelect() {
    return {
      id: true,
      clientCompanyId: true,
      name: true,
      platformCode: true,
      externalCode: true,
      city: true,
      region: true,
      address: true,
      latitude: true,
      longitude: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  private async resolveReadableCompanyId(actorCompanyId: string, actorRole: UserRole, requestedCompanyId?: string) {
    const requested = (requestedCompanyId || '').trim()
    if (!requested || requested === actorCompanyId) {
      return actorCompanyId
    }
    const observerCompanyId = resolveObserverScopeCompanyId({
      actorCompanyId,
      actorRole,
      requestedCompanyId: requested,
    })
    if (observerCompanyId !== actorCompanyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: observerCompanyId },
        select: { id: true, type: true },
      })
      if (!company) {
        throw new NotFoundException('Company not found')
      }
      if (company.type !== CompanyType.CLIENT) {
        throw new BadRequestException('Observer scope must be a CLIENT company')
      }
      return observerCompanyId
    }
    if ((this.serviceContractsService as any).getLinkedClientAccess) {
      const linkedAccess = await this.serviceContractsService.getLinkedClientAccess(actorCompanyId, requested)
      if (!linkedAccess) {
        throw new NotFoundException('Linked client not found')
      }
    } else {
      await this.serviceContractsService.assertPrimaryLinkedClientAccess(actorCompanyId, requested)
    }
    const linkedCompany = await this.prisma.company.findUnique({
      where: { id: requested },
      select: { type: true },
    })
    if (!linkedCompany || linkedCompany.type !== CompanyType.CLIENT) {
      throw new BadRequestException('Linked client scope must be a CLIENT company')
    }
    return requested
  }

  private async resolveLocationScope(
    actorCompanyId: string,
    actorRole: UserRole,
    actorUserId: string,
    scopeCompanyId: string,
  ) {
    const actorCompany = await this.prisma.company.findUnique({
      where: { id: actorCompanyId },
      select: { type: true },
    })

    if (
      scopeCompanyId === actorCompanyId &&
      actorCompany?.type === CompanyType.CLIENT &&
      this.clientLeadershipRoles.has(actorRole)
    ) {
      return { mode: 'tenant_wide' as const, locationIds: [] as string[] }
    }

    return resolveActorLocationScope({
      prisma: this.prisma,
      actor: {
        id: actorUserId,
        role: actorRole,
        companyId: actorCompanyId,
      },
      scopeCompanyId,
    })
  }

  private async ensureExists(companyId: string, id: string) {
    const exists = await this.prisma.location.findFirst({
      where: {
        id,
        clientCompanyId: companyId,
      },
      select: { id: true },
    })

    if (!exists) {
      throw new NotFoundException('Location not found')
    }
  }
}
