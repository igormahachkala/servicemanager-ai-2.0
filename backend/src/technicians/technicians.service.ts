import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'

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

  async list(companyId: string) {
    return this.prisma.user.findMany({
      where: {
        companyId,
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
        email: true,
        role: true,
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

    const activeClientIds = await this.serviceContractsService.listPrimaryLinkedClientIds(providerCompanyId)
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

    const bindings = await this.prisma.userLocationBinding.findMany({
      where: {
        userId: technicianId,
        companyId: { in: scopedClientIds },
        location: {
          clientCompanyId: { in: scopedClientIds },
          isActive: true,
        },
      },
      select: {
        companyId: true,
        locationId: true,
      },
      orderBy: [{ companyId: 'asc' }, { locationId: 'asc' }],
    })

    const grouped = new Map<string, { locationIds: string[] }>()
    for (const binding of bindings) {
      const current = grouped.get(binding.companyId) ?? { locationIds: [] }
      current.locationIds.push(binding.locationId)
      grouped.set(binding.companyId, current)
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
      const hasBindings = scope.locationIds.length > 0
      const visibleLocations = locations.filter((location) => {
        if (location.clientCompanyId !== company.id) return false
        if (!hasBindings) return true
        return scope.locationIds.includes(location.id)
      })

      return {
        clientCompany: company,
        locationScope: hasBindings ? 'SELECTED_LOCATIONS' : 'ALL_COMPANY_LOCATIONS',
        locations: visibleLocations,
        categories: categories.filter((category) => category.companyId === company.id),
        bindingCount: scope.locationIds.length,
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
          companyId: binding.clientCompanyId,
          locationId,
        })
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userLocationBinding.deleteMany({
        where: {
          userId: technicianId,
          companyId: { in: clientCompanyIds },
        },
      })

      if (rows.length > 0) {
        await tx.userLocationBinding.createMany({
          data: rows,
        })
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

    await this.serviceContractsService.assertPrimaryLinkedClientAccess(providerCompanyId, clientCompanyId)

    const bindings = await this.prisma.userLocationBinding.findMany({
      where: {
        userId: technicianId,
        companyId: clientCompanyId,
        location: { clientCompanyId },
      },
      select: {
        locationId: true,
      },
    })

    const hasExplicitBindings = bindings.length > 0
    if (hasExplicitBindings) {
      const locationAllowed = bindings.some((binding) => binding.locationId === locationId)
      if (!locationAllowed) {
        throw new ForbiddenException('Technician is not bound to this client location')
      }
    }

    return {
      companyId: clientCompanyId,
      locationScope: hasExplicitBindings ? 'SELECTED_LOCATIONS' : 'ALL_COMPANY_LOCATIONS',
    }
  }

  async getLocationBindings(actorCompanyId: string, technicianId: string, requestedCompanyId?: string) {
    await this.ensureLocationBindableUser(actorCompanyId, technicianId)
    const scopeCompanyId = await this.resolveBindingScopeCompanyId(actorCompanyId, requestedCompanyId)

    const availableLocations = await this.prisma.location.findMany({
      where: {
        clientCompanyId: scopeCompanyId,
        isActive: true,
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
          companyId: scopeCompanyId,
          location: { clientCompanyId: scopeCompanyId },
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

    const locationIds = Array.from(new Set(existingBindings.map((item) => item.locationId)))

    return {
      companyId: scopeCompanyId,
      locationIds,
      availableLocations,
      hasExplicitRestrictions: locationIds.length > 0,
    }
  }

  async setLocationBindings(
    actorCompanyId: string,
    technicianId: string,
    payload: { companyId?: string; locationIds?: string[] },
  ) {
    await this.ensureLocationBindableUser(actorCompanyId, technicianId)
    const scopeCompanyId = await this.resolveBindingScopeCompanyId(actorCompanyId, payload.companyId)
    const locationIds = Array.from(new Set((payload.locationIds ?? []).map((id) => (id ?? '').trim()).filter(Boolean)))

    const validLocations = locationIds.length
      ? await this.prisma.location.findMany({
          where: {
            id: { in: locationIds },
            clientCompanyId: scopeCompanyId,
            isActive: true,
          },
          select: { id: true },
        })
      : []

    if (validLocations.length !== locationIds.length) {
      throw new BadRequestException('Some locationIds are not available in current scope')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userLocationBinding.deleteMany({
        where: {
          userId: technicianId,
          companyId: scopeCompanyId,
        },
      })

      if (locationIds.length > 0) {
        await tx.userLocationBinding.createMany({
          data: locationIds.map((locationId) => ({
            userId: technicianId,
            locationId,
            companyId: scopeCompanyId,
          })),
        })
      }
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
        id: { in: normalizedIds },
      },
      select: {
        id: true,
      },
    })

    if (specs.length !== normalizedIds.length) {
      throw new BadRequestException('Some specializationIds are invalid')
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
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
        email: true,
        role: true,
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
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
      },
    })

    if (!tech) {
      throw new NotFoundException('Technician not found')
    }

    return tech
  }

  private async ensureLocationBindableUser(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
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
    await this.serviceContractsService.assertPrimaryLinkedClientAccess(actorCompanyId, scopeCompanyId)
  }
}
