import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, UserAccessLocationMode, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { EXECUTOR_CAPABLE_ROLES } from '../common/executor.utils'
import {
  type ConstructorLocationMode,
  interpretUserAccessLocationScope,
  uniqueLocationIds,
} from '../common/user-access-scope-mode.utils'

const LOCATION_BINDABLE_USER_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.TECHNICIAN,
  UserRole.CLIENT,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.STAFF,
]

@Injectable()
export class TechniciansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  private normalizeCompanyId(value?: string | null) {
    if (typeof value !== 'string') return ''
    const normalized = value.trim()
    if (!normalized || normalized === 'undefined' || normalized === 'null') {
      return ''
    }
    return normalized
  }

  private isTableMissingError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021'
    )
  }

  private resolveLocationBindingStorageCompanyId(actorCompanyId: string, scopeCompanyId: string) {
    return scopeCompanyId === actorCompanyId ? scopeCompanyId : actorCompanyId
  }

  private async getExplicitLocationMode(userId: string, storageCompanyId: string) {
    const scope = await this.prisma.userAccessScope.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId: storageCompanyId,
        },
      },
      select: { locationMode: true },
    })
    return scope?.locationMode ?? null
  }

  private resolveLocationBindingCompanyFilter(
    storageCompanyId: string,
    scopeCompanyId: string,
    explicitLocationMode: UserAccessLocationMode | null,
  ) {
    if (explicitLocationMode) return storageCompanyId
    if (storageCompanyId === scopeCompanyId) return storageCompanyId
    return { in: uniqueLocationIds([storageCompanyId, scopeCompanyId]) }
  }

  private locationScopeResponseLabel(locationMode: ConstructorLocationMode) {
    if (locationMode === 'LEGACY_AUTO') return 'ALL_COMPANY_LOCATIONS'
    return locationMode
  }

  private async persistLocationScopeMode(
    tx: Prisma.TransactionClient,
    userId: string,
    storageCompanyId: string,
    locationIds: string[],
  ) {
    const locationMode = locationIds.length > 0
      ? UserAccessLocationMode.SELECTED_LOCATIONS
      : UserAccessLocationMode.RESTRICTED_EMPTY
    await tx.userAccessScope.upsert({
      where: { userId_companyId: { userId, companyId: storageCompanyId } },
      update: { locationMode },
      create: {
        userId,
        companyId: storageCompanyId,
        locationMode,
      },
    })
  }

  private async persistLocationScopeModeFromStoredBindings(
    tx: Prisma.TransactionClient,
    userId: string,
    storageCompanyId: string,
  ) {
    const bindings = await tx.userLocationBinding.findMany({
      where: {
        userId,
        companyId: storageCompanyId,
        location: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        locationId: true,
      },
    })
    await this.persistLocationScopeMode(tx, userId, storageCompanyId, bindings.map((binding) => binding.locationId))
  }

  async list(companyId: string) {
    return this.prisma.user.findMany({
      where: {
        companyId,
        isExecutor: true,
        isActive: true,
        deletedAt: null,
        role: { in: Array.from(EXECUTOR_CAPABLE_ROLES) },
      },
      select: {
        id: true,
        email: true,
        role: true,
        isExecutor: true,
        createdAt: true,
        technicianSpecializations: {
          include: {
            specialization: true,
          },
        },
        locationBindings: {
          select: {
            id: true,
            locationId: true,
            companyId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getMe(companyId: string, userId: string) {
    const tech = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        role: UserRole.TECHNICIAN,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
        technicianSpecializations: {
          select: {
            specialization: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
          orderBy: {
            specialization: {
              name: 'asc',
            },
          },
        },
        locationBindings: {
          select: {
            id: true,
            locationId: true,
            companyId: true,
          },
        },
      },
    })

    if (!tech) {
      throw new NotFoundException('Technician not found')
    }

    return {
      id: tech.id,
      email: tech.email,
      role: tech.role,
      companyId: tech.companyId,
      createdAt: tech.createdAt,
      specializations: tech.technicianSpecializations.map((x) => x.specialization),
      specializationCount: tech.technicianSpecializations.length,
      bindingCount: tech.locationBindings.length,
    }
  }

  async getBoundContexts(providerCompanyId: string, technicianId: string, linkedClientCompanyId?: string) {
    await this.ensureTechnician(providerCompanyId, technicianId)

    const activeClientIds = (this.serviceContractsService as any).listActiveLinkedClientIds
      ? await this.serviceContractsService.listActiveLinkedClientIds(providerCompanyId)
      : await this.serviceContractsService.listPrimaryLinkedClientIds(providerCompanyId)
    if (activeClientIds.length === 0) {
      return []
    }
    const normalizedRequestedClientId = this.normalizeCompanyId(linkedClientCompanyId)
    const scopedClientIds = normalizedRequestedClientId
      ? activeClientIds.includes(normalizedRequestedClientId)
        ? [normalizedRequestedClientId]
        : []
      : activeClientIds
    if (scopedClientIds.length === 0) {
      return []
    }

    const explicitLocationMode = await this.getExplicitLocationMode(technicianId, providerCompanyId)
    const bindingCompanyFilter = explicitLocationMode
      ? providerCompanyId
      : { in: uniqueLocationIds([providerCompanyId, ...scopedClientIds]) }
    const bindings = await this.prisma.userLocationBinding.findMany({
      where: {
        userId: technicianId,
        companyId: bindingCompanyFilter,
        location: {
          clientCompanyId: { in: scopedClientIds },
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        companyId: true,
        locationId: true,
        location: { select: { clientCompanyId: true } },
      },
      orderBy: [{ locationId: 'asc' }],
    })

    const grouped = new Map<string, { locationIds: string[] }>()
    for (const binding of bindings) {
      const clientCompanyId = binding.location?.clientCompanyId ?? binding.companyId
      const current = grouped.get(clientCompanyId) ?? { locationIds: [] }
      current.locationIds.push(binding.locationId)
      grouped.set(clientCompanyId, current)
    }

    const clientCompanyIds = scopedClientIds
    const companies = await this.prisma.company.findMany({
      where: { id: { in: clientCompanyIds }, type: 'CLIENT' },
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: { name: 'asc' },
    })

    const locations = await this.prisma.location.findMany({
      where: {
        clientCompanyId: { in: clientCompanyIds },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        clientCompanyId: true,
        name: true,
        city: true,
        region: true,
        address: true,
        platformCode: true,
        externalCode: true,
        isActive: true,
      },
      orderBy: [{ name: 'asc' }],
    })

    const categories = await this.prisma.problemCategory.findMany({
      where: {
        companyId: { in: clientCompanyIds },
        isActive: true,
      },
      include: {
        specializationLinks: {
          include: {
            specialization: true,
          },
          orderBy: {
            specialization: {
              name: 'asc',
            },
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    })

    return companies.map((company) => {
      const scope = grouped.get(company.id) ?? { locationIds: [] }
      const interpretedScope = interpretUserAccessLocationScope({
        explicitLocationMode,
        locationIds: scope.locationIds,
      })
      const visibleLocations = locations.filter((location) => {
        if (location.clientCompanyId !== company.id) return false
        if (interpretedScope.runtimeMode === 'tenant_wide') return true
        if (interpretedScope.runtimeMode === 'restricted_empty') return false
        return interpretedScope.locationIds.includes(location.id)
      })

      return {
        clientCompany: company,
        locationScope: this.locationScopeResponseLabel(interpretedScope.locationMode),
        locationScopeMode: interpretedScope.locationMode,
        locations: visibleLocations,
        categories: categories.filter((category) => category.companyId === company.id),
        bindingCount: interpretedScope.locationIds.length,
      }
    })
  }

  async setBindings(
    providerCompanyId: string,
    technicianId: string,
    bindings: Array<{ clientCompanyId: string; locationIds?: string[] }>,
  ) {
    await this.ensureTechnician(providerCompanyId, technicianId)

    const normalizedBindings = (bindings ?? []).map((binding) => ({
      clientCompanyId: (binding.clientCompanyId ?? '').trim(),
      locationIds: [...new Set((binding.locationIds ?? []).map((id) => (id ?? '').trim()).filter(Boolean))],
    }))

    const clientCompanyIds = [...new Set(normalizedBindings.map((binding) => binding.clientCompanyId).filter(Boolean))]
    for (const clientCompanyId of clientCompanyIds) {
      await this.assertBindingScopeAccess(providerCompanyId, clientCompanyId)
    }

    const locationIds = [...new Set(normalizedBindings.flatMap((binding) => binding.locationIds))]
    const locations = locationIds.length
      ? await this.prisma.location.findMany({
          where: {
            id: { in: locationIds },
            clientCompanyId: { in: clientCompanyIds },
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
            clientCompanyId: true,
          },
        })
      : []

    if (locations.length !== locationIds.length) {
      throw new BadRequestException('Some locationIds are invalid for the selected client companies')
    }

    const locationsById = new Map(locations.map((location) => [location.id, location]))
    const rows: Prisma.UserLocationBindingCreateManyInput[] = []

    for (const binding of normalizedBindings) {
      if (!binding.clientCompanyId) {
        throw new BadRequestException('clientCompanyId is required')
      }

      for (const locationId of binding.locationIds) {
        const location = locationsById.get(locationId)
        if (!location || location.clientCompanyId !== binding.clientCompanyId) {
          throw new BadRequestException('Some locationIds do not belong to the selected client company')
        }

        rows.push({
          userId: technicianId,
          companyId: providerCompanyId,
          locationId,
        })
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userLocationBinding.deleteMany({
        where: {
          userId: technicianId,
          location: { clientCompanyId: { in: clientCompanyIds } },
        },
      })

      if (rows.length > 0) {
        await tx.userLocationBinding.createMany({
          data: rows,
          skipDuplicates: true,
        })
      }
      if (clientCompanyIds.length > 0) {
        await this.persistLocationScopeModeFromStoredBindings(tx, technicianId, providerCompanyId)
      }
    })

    return this.getBoundContexts(providerCompanyId, technicianId)
  }

  async resolveBoundCreateScope(
    providerCompanyId: string,
    technicianId: string,
    clientCompanyId: string,
    locationId: string,
  ) {
    await this.ensureTechnician(providerCompanyId, technicianId)

    if (!clientCompanyId) {
      throw new BadRequestException('clientCompanyId is required for technician ticket creation')
    }

    if ((this.serviceContractsService as any).getLinkedClientAccess) {
      const linkedAccess = await this.serviceContractsService.getLinkedClientAccess(providerCompanyId, clientCompanyId)
      if (!linkedAccess) {
        throw new NotFoundException('Linked client not found')
      }
    } else {
      await this.serviceContractsService.assertPrimaryLinkedClientAccess(providerCompanyId, clientCompanyId)
    }

    const explicitLocationMode = await this.getExplicitLocationMode(technicianId, providerCompanyId)
    const bindingCompanyFilter = this.resolveLocationBindingCompanyFilter(
      providerCompanyId,
      clientCompanyId,
      explicitLocationMode,
    )
    const bindings = await this.prisma.userLocationBinding.findMany({
      where: {
        userId: technicianId,
        companyId: bindingCompanyFilter,
        location: { clientCompanyId, isActive: true, deletedAt: null },
      },
      select: {
        locationId: true,
      },
    })

    const locationScope = interpretUserAccessLocationScope({
      explicitLocationMode,
      locationIds: bindings.map((binding) => binding.locationId),
    })
    if (
      locationScope.runtimeMode === 'restricted_empty' ||
      (locationScope.runtimeMode === 'bound_locations' && !locationScope.locationIds.includes(locationId))
    ) {
      throw new ForbiddenException('Technician is not bound to this client location')
    }

    return {
      companyId: clientCompanyId,
      locationScope: this.locationScopeResponseLabel(locationScope.locationMode),
      locationScopeMode: locationScope.locationMode,
    }
  }

  async getLocationBindings(actorCompanyId: string, technicianId: string, requestedCompanyId?: string) {
    await this.ensureLocationBindableUser(actorCompanyId, technicianId)
    const scopeCompanyId = await this.resolveBindingScopeCompanyId(actorCompanyId, requestedCompanyId)
    const storageCompanyId = this.resolveLocationBindingStorageCompanyId(actorCompanyId, scopeCompanyId)
    const explicitLocationMode = await this.getExplicitLocationMode(technicianId, storageCompanyId)
    const bindingCompanyFilter = this.resolveLocationBindingCompanyFilter(
      storageCompanyId,
      scopeCompanyId,
      explicitLocationMode,
    )

    const availableLocations = await this.prisma.location.findMany({
      where: {
        clientCompanyId: scopeCompanyId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        clientCompanyId: true,
        name: true,
        city: true,
        region: true,
        address: true,
        platformCode: true,
        externalCode: true,
        isActive: true,
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    })

    let existingBindings: Array<{ locationId: string }>
    try {
      existingBindings = await this.prisma.userLocationBinding.findMany({
        where: {
          userId: technicianId,
          companyId: bindingCompanyFilter,
          location: { clientCompanyId: scopeCompanyId, isActive: true, deletedAt: null },
        },
        select: { locationId: true },
      })
    } catch (error) {
      if (!this.isTableMissingError(error)) {
        throw error
      }
      console.warn('UserLocationBinding table missing, fallback to empty')
      existingBindings = []
    }

    const locationScope = interpretUserAccessLocationScope({
      explicitLocationMode,
      locationIds: existingBindings.map((item) => item.locationId),
    })
    const locationIds = locationScope.runtimeMode === 'restricted_empty' ? [] : locationScope.locationIds

    return {
      companyId: scopeCompanyId,
      locationIds,
      availableLocations,
      locationScope: this.locationScopeResponseLabel(locationScope.locationMode),
      locationScopeMode: locationScope.locationMode,
      hasExplicitRestrictions: locationScope.locationMode !== 'LEGACY_AUTO' || locationIds.length > 0,
    }
  }

  async setLocationBindings(
    actorCompanyId: string,
    technicianId: string,
    payload: { companyId?: string; locationIds?: string[] },
  ) {
    await this.ensureLocationBindableUser(actorCompanyId, technicianId)
    const scopeCompanyId = await this.resolveBindingScopeCompanyId(actorCompanyId, payload.companyId)
    const storageCompanyId = this.resolveLocationBindingStorageCompanyId(actorCompanyId, scopeCompanyId)
    const locationIds = Array.from(new Set((payload.locationIds ?? []).map((id) => (id ?? '').trim()).filter(Boolean)))

    const validLocations = locationIds.length
      ? await this.prisma.location.findMany({
          where: {
            id: { in: locationIds },
            clientCompanyId: scopeCompanyId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        })
      : []

    if (validLocations.length !== locationIds.length) {
      const validSet = new Set(validLocations.map((l) => l.id))
      const rejected = locationIds.filter((id) => !validSet.has(id))
      throw new BadRequestException(
        `Some locationIds are not available in current scope. scopeCompanyId=${scopeCompanyId}, submitted=${locationIds.length}, available=${validLocations.length}, rejected=[${rejected.join(', ')}]`,
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userLocationBinding.deleteMany({
        where: {
          userId: technicianId,
          location: { clientCompanyId: scopeCompanyId },
        },
      })

      if (locationIds.length > 0) {
        await tx.userLocationBinding.createMany({
          data: locationIds.map((locationId) => ({
            userId: technicianId,
            locationId,
            companyId: storageCompanyId,
          })),
          skipDuplicates: true,
        })
      }
      await this.persistLocationScopeModeFromStoredBindings(tx, technicianId, storageCompanyId)
    })

    return this.getLocationBindings(actorCompanyId, technicianId, scopeCompanyId)
  }

  async setSpecializations(companyId: string, technicianId: string, specializationIds: string[]) {
    const normalizedIds = [...new Set(
      (specializationIds ?? [])
        .map((id) => (id ?? '').trim())
        .filter((id) => id.length > 0),
    )]

    const tech = await this.ensureTechnician(companyId, technicianId)

    const specs = await this.prisma.specialization.findMany({
      where: {
        companyId,
        isActive: true,
        id: { in: normalizedIds },
      },
      select: {
        id: true,
      },
    })

    const found = new Set(specs.map((s) => s.id))
    const invalid = normalizedIds.filter((id) => !found.has(id))
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Some specializationIds are invalid (inactive, wrong tenant, or unknown): ${invalid.join(', ')}`,
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.technicianSpecialization.deleteMany({
        where: {
          userId: technicianId,
          user: {
            companyId,
          },
        },
      })

      if (normalizedIds.length > 0) {
        await tx.technicianSpecialization.createMany({
          data: normalizedIds.map((specializationId) => ({
            userId: technicianId,
            specializationId,
          })),
        })
      }
    })

    return this.prisma.user.findFirst({
      where: {
        id: tech.id,
        companyId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isExecutor: true,
        createdAt: true,
        technicianSpecializations: {
          include: {
            specialization: true,
          },
        },
      },
    })
  }

  private async ensureTechnician(companyId: string, technicianId: string) {
    const tech = await this.prisma.user.findFirst({
      where: {
        id: technicianId,
        companyId,
        isExecutor: true,
        isActive: true,
        deletedAt: null,
        role: { in: Array.from(EXECUTOR_CAPABLE_ROLES) },
      },
      select: {
        id: true,
      },
    })

    if (!tech) {
      throw new NotFoundException('Executor not found')
    }

    return tech
  }

  private async ensureLocationBindableUser(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        isActive: true,
        deletedAt: null,
        role: { in: LOCATION_BINDABLE_USER_ROLES },
      },
      select: {
        id: true,
      },
    })

    if (!user) {
      throw new NotFoundException('Location-bindable user not found')
    }

    return user
  }

  private async resolveBindingScopeCompanyId(actorCompanyId: string, requestedCompanyId?: string) {
    const normalizedRequested = this.normalizeCompanyId(requestedCompanyId)
    if (!normalizedRequested || normalizedRequested === actorCompanyId) {
      return actorCompanyId
    }
    await this.assertBindingScopeAccess(actorCompanyId, normalizedRequested)
    return normalizedRequested
  }

  private async assertBindingScopeAccess(actorCompanyId: string, scopeCompanyId: string) {
    if (scopeCompanyId === actorCompanyId) {
      return
    }
    const access = await this.serviceContractsService.getLinkedClientAccess(actorCompanyId, scopeCompanyId)
    if (!access) {
      throw new NotFoundException('Linked client not found')
    }
  }
}
