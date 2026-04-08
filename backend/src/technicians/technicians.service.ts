import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'

@Injectable()
export class TechniciansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

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
        technicianClientBindings: {
          select: {
            id: true,
            clientCompanyId: true,
            locationId: true,
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
        technicianClientBindings: {
          select: {
            id: true,
            clientCompanyId: true,
            locationId: true,
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
      bindingCount: tech.technicianClientBindings.length,
    }
  }

  async getBoundContexts(providerCompanyId: string, technicianId: string) {
    await this.ensureTechnician(providerCompanyId, technicianId)

    const activeClientIds = await this.serviceContractsService.listPrimaryLinkedClientIds(providerCompanyId)
    if (activeClientIds.length === 0) {
      return []
    }

    const bindings = await this.prisma.technicianClientBinding.findMany({
      where: {
        providerCompanyId,
        technicianUserId: technicianId,
        clientCompanyId: { in: activeClientIds },
      },
      select: {
        clientCompanyId: true,
        locationId: true,
      },
      orderBy: [{ clientCompanyId: 'asc' }, { locationId: 'asc' }],
    })

    if (bindings.length === 0) {
      return []
    }

    const grouped = new Map<string, { allLocations: boolean; locationIds: string[] }>()
    for (const binding of bindings) {
      const current = grouped.get(binding.clientCompanyId) ?? { allLocations: false, locationIds: [] }
      if (!binding.locationId) {
        current.allLocations = true
        current.locationIds = []
      } else if (!current.allLocations) {
        current.locationIds.push(binding.locationId)
      }
      grouped.set(binding.clientCompanyId, current)
    }

    const clientCompanyIds = [...grouped.keys()]
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
      const scope = grouped.get(company.id) ?? { allLocations: false, locationIds: [] }
      const visibleLocations = locations.filter((location) => {
        if (location.clientCompanyId !== company.id) return false
        if (scope.allLocations) return true
        return scope.locationIds.includes(location.id)
      })

      return {
        clientCompany: company,
        locationScope: scope.allLocations ? 'ALL_COMPANY_LOCATIONS' : 'SELECTED_LOCATIONS',
        locations: visibleLocations,
        categories: categories.filter((category) => category.companyId === company.id),
        bindingCount: scope.allLocations ? 1 : visibleLocations.length,
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
    const activeClientIds = await this.serviceContractsService.listPrimaryLinkedClientIds(providerCompanyId)

    for (const clientCompanyId of clientCompanyIds) {
      if (!activeClientIds.includes(clientCompanyId)) {
        throw new BadRequestException('Technician can be bound only to active PRIMARY linked clients')
      }
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
    const rows: Prisma.TechnicianClientBindingCreateManyInput[] = []

    for (const binding of normalizedBindings) {
      if (!binding.clientCompanyId) {
        throw new BadRequestException('clientCompanyId is required')
      }

      if (binding.locationIds.length === 0) {
        rows.push({
          providerCompanyId,
          technicianUserId: technicianId,
          clientCompanyId: binding.clientCompanyId,
          locationId: null,
        })
        continue
      }

      for (const locationId of binding.locationIds) {
        const location = locationsById.get(locationId)
        if (!location || location.clientCompanyId !== binding.clientCompanyId) {
          throw new BadRequestException('Some locationIds do not belong to the selected client company')
        }

        rows.push({
          providerCompanyId,
          technicianUserId: technicianId,
          clientCompanyId: binding.clientCompanyId,
          locationId,
        })
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.technicianClientBinding.deleteMany({
        where: {
          providerCompanyId,
          technicianUserId: technicianId,
        },
      })

      if (rows.length > 0) {
        await tx.technicianClientBinding.createMany({
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

    const bindings = await this.prisma.technicianClientBinding.findMany({
      where: {
        providerCompanyId,
        technicianUserId: technicianId,
        clientCompanyId,
      },
      select: {
        locationId: true,
      },
    })

    if (bindings.length === 0) {
      throw new ForbiddenException('Technician is not bound to this client company')
    }

    const hasCompanyWideBinding = bindings.some((binding) => !binding.locationId)
    if (!hasCompanyWideBinding) {
      const locationAllowed = bindings.some((binding) => binding.locationId === locationId)
      if (!locationAllowed) {
        throw new ForbiddenException('Technician is not bound to this client location')
      }
    }

    return {
      companyId: clientCompanyId,
      locationScope: hasCompanyWideBinding ? 'ALL_COMPANY_LOCATIONS' : 'SELECTED_LOCATIONS',
    }
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
}
