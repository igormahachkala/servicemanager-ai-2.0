import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CompanyType, ServiceContractLocationMode, ServiceContractRole, ServiceContractStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'

import { CreateServiceContractDto } from './dto/create-service-contract.dto'
import { UpdateServiceContractDto } from './dto/update-service-contract.dto'
import {
  resolveServiceContractLocationScope,
  serviceContractLocationRowsFromScope,
  uniqueServiceContractLocationIds,
  type ResolvedServiceContractLocationScope,
} from './service-contract-location-scope'
import { activeServiceContractWhere, isServiceContractEffective } from './service-contract-window'

@Injectable()
export class ServiceContractsService {
  constructor(private prisma: PrismaService) {}

  private normalizeId(value?: string | null): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  async listAll() {
    const contracts = await this.prisma.serviceContract.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: this.contractSelect(),
    })
    return this.enrichContracts(contracts)
  }

  async listForCompany(companyId: string) {
    await this.ensureCompanyExists(companyId)

    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        OR: [{ clientCompanyId: companyId }, { providerCompanyId: companyId }],
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: this.contractSelect(),
    })
    return this.enrichContracts(contracts)
  }

  async listLinkedClients(providerCompanyId: string) {
    const normalizedProviderCompanyId = this.normalizeId(providerCompanyId)
    if (!normalizedProviderCompanyId) {
      return []
    }

    await this.ensureCompanyExists(normalizedProviderCompanyId)

    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        providerCompanyId: normalizedProviderCompanyId,
        ...activeServiceContractWhere(),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: this.contractSelect(),
    })

    const normalizedContracts = contracts.filter(
      (contract) =>
        !!contract.clientCompany &&
        !!this.normalizeId(contract.clientCompany.id) &&
        !!this.normalizeId(contract.clientCompany.name),
    )

    if (normalizedContracts.length === 0) {
      return []
    }

    const clientCompanyIds = Array.from(
      new Set(
        normalizedContracts
          .map((contract) => this.normalizeId(contract.clientCompany.id))
          .filter((companyId): companyId is string => !!companyId),
      ),
    )

    if (clientCompanyIds.length === 0) {
      return []
    }

    const [locationCounts, openTicketCounts] = await Promise.all([
      this.prisma.location.groupBy({
        by: ['clientCompanyId'],
        where: {
          clientCompanyId: { in: clientCompanyIds },
        },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['companyId'],
        where: {
          companyId: { in: clientCompanyIds },
          status: {
            in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'],
          },
        },
        _count: { _all: true },
      }),
    ])

    const locationCountByCompanyId = new Map(locationCounts.map((row) => [row.clientCompanyId, row._count._all]))
    const openTicketCountByCompanyId = new Map(openTicketCounts.map((row) => [row.companyId, row._count._all]))

    const enrichedContracts = await this.enrichContracts(normalizedContracts)

    return enrichedContracts.map((contract) => {
      const clientCompanyId = this.normalizeId(contract.clientCompany.id) ?? contract.clientCompany.id

      return {
        ...contract,
        // Flat compatibility shape for consumers expecting { id, name, type }.
        id: clientCompanyId,
        serviceContractId: contract.id,
        linkedClientCompanyId: clientCompanyId,
        name: contract.clientCompany.name,
        type: contract.role,
        summary: {
          openTickets: openTicketCountByCompanyId.get(clientCompanyId) ?? 0,
          locations: contract.locationSummary.effectiveLocations,
          totalLocations: locationCountByCompanyId.get(clientCompanyId) ?? 0,
          publicRequestEnabled: !!contract.clientCompany.publicRequestEnabled,
        },
      }
    })
  }

  async listLinkedProviders(clientCompanyId: string) {
    await this.ensureCompanyExists(clientCompanyId)

    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        clientCompanyId,
        ...activeServiceContractWhere(),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: this.contractSelect(),
    })
    return this.enrichContracts(contracts)
  }

  async getOne(id: string) {
    const contract = await this.prisma.serviceContract.findUnique({
      where: { id },
      select: this.contractSelect(),
    })

    if (!contract) {
      throw new NotFoundException('Service contract not found')
    }

    return this.enrichContract(contract)
  }

  async create(dto: CreateServiceContractDto, actorUserId?: string | null) {
    await this.validateContractParties(dto.clientCompanyId, dto.providerCompanyId)
    const locationIds = this.normalizeIds(dto.locationIds)
    const role = dto.role ?? ServiceContractRole.PRIMARY
    const locationMode = this.resolveCreateLocationMode(dto.locationMode, locationIds)
    this.validateLocationMode(role, locationMode)
    const persistedLocationIds = locationMode === ServiceContractLocationMode.SELECTED_LOCATIONS ? locationIds : []
    await this.assertLocationsBelongToClient(dto.clientCompanyId, persistedLocationIds)
    this.validateDates(dto.startsAt, dto.endsAt)

    const existing = await this.prisma.serviceContract.findUnique({
      where: {
        clientCompanyId_providerCompanyId: {
          clientCompanyId: dto.clientCompanyId,
          providerCompanyId: dto.providerCompanyId,
        },
      },
      select: { id: true },
    })

    if (existing) {
      throw new BadRequestException('Service contract already exists for this client and provider')
    }

    const createdId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceContract.create({
        data: {
          clientCompanyId: dto.clientCompanyId,
          providerCompanyId: dto.providerCompanyId,
          status: dto.status ?? ServiceContractStatus.DRAFT,
          role,
          locationMode,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          notes: dto.notes?.trim() || null,
          locations: {
            create: persistedLocationIds.map((locationId) => ({
              clientCompanyId: dto.clientCompanyId,
              locationId,
            })),
          },
        },
        select: { id: true },
      })
      await this.recordContractAuditTx(tx, {
        type: 'service_contract.created',
        actorUserId,
        companyId: dto.clientCompanyId,
        entityId: created.id,
        payload: {
          after: {
            clientCompanyId: dto.clientCompanyId,
            providerCompanyId: dto.providerCompanyId,
            status: dto.status ?? ServiceContractStatus.DRAFT,
            role,
            locationMode,
            locationIds: persistedLocationIds,
          },
        },
      })
      return created.id
    })

    return this.getOne(createdId)
  }

  async update(id: string, dto: UpdateServiceContractDto, actorUserId?: string | null) {
    const current = await this.prisma.serviceContract.findUnique({
      where: { id },
      select: {
        id: true,
        clientCompanyId: true,
        providerCompanyId: true,
        status: true,
        role: true,
        locationMode: true,
        startsAt: true,
        endsAt: true,
        notes: true,
        locations: { select: { locationId: true } },
      },
    })
    if (!current) throw new NotFoundException('Service contract not found')

    const nextClientCompanyId = dto.clientCompanyId ?? current.clientCompanyId
    const nextProviderCompanyId = dto.providerCompanyId ?? current.providerCompanyId
    if (nextClientCompanyId !== current.clientCompanyId || nextProviderCompanyId !== current.providerCompanyId) {
      await this.validateContractParties(nextClientCompanyId, nextProviderCompanyId)
      await this.assertContractUnique(nextClientCompanyId, nextProviderCompanyId, id)
    }

    const nextStartsAt = dto.startsAt !== undefined ? (dto.startsAt ? new Date(dto.startsAt) : null) : current.startsAt
    const nextEndsAt = dto.endsAt !== undefined ? (dto.endsAt ? new Date(dto.endsAt) : null) : current.endsAt
    this.validateDateValues(nextStartsAt, nextEndsAt)
    const explicitLocationIds = dto.locationIds === undefined ? undefined : this.normalizeIds(dto.locationIds)
    const nextRole = dto.role ?? current.role
    const nextLocationMode = this.resolveUpdateLocationMode({
      currentRole: current.role,
      currentLocationMode: current.locationMode,
      nextRole,
      requestedLocationMode: dto.locationMode,
      explicitLocationIds,
    })
    this.validateLocationMode(nextRole, nextLocationMode)

    const persistedLocationIds =
      nextLocationMode === ServiceContractLocationMode.SELECTED_LOCATIONS
        ? (explicitLocationIds ?? current.locations.map((row) => row.locationId))
        : []

    if (
      nextLocationMode === ServiceContractLocationMode.SELECTED_LOCATIONS &&
      nextClientCompanyId !== current.clientCompanyId &&
      explicitLocationIds === undefined
    ) {
      throw new BadRequestException('locationIds are required when changing client company for selected scope')
    }

    await this.assertLocationsBelongToClient(nextClientCompanyId, persistedLocationIds)

    const updatedId = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceContract.update({
        where: { id },
        data: {
          ...(nextClientCompanyId !== current.clientCompanyId ? { clientCompanyId: nextClientCompanyId } : {}),
          ...(nextProviderCompanyId !== current.providerCompanyId ? { providerCompanyId: nextProviderCompanyId } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(nextLocationMode !== current.locationMode ? { locationMode: nextLocationMode } : {}),
          ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null } : {}),
          ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
          ...(dto.locationIds !== undefined || dto.locationMode !== undefined || nextClientCompanyId !== current.clientCompanyId
            ? {
                locations: {
                  deleteMany: {},
                  create: persistedLocationIds.map((locationId) => ({
                    clientCompanyId: nextClientCompanyId,
                    locationId,
                  })),
                },
              }
            : {}),
        },
        select: { id: true },
      })
      await this.recordContractAuditTx(tx, {
        type: 'service_contract.updated',
        actorUserId,
        companyId: nextClientCompanyId,
        entityId: updated.id,
        payload: {
          before: {
            clientCompanyId: current.clientCompanyId,
            providerCompanyId: current.providerCompanyId,
            status: current.status,
            role: current.role,
            locationMode: current.locationMode,
            locationIds: current.locations.map((row) => row.locationId),
            startsAt: current.startsAt,
            endsAt: current.endsAt,
            notes: current.notes,
          },
          after: {
            clientCompanyId: nextClientCompanyId,
            providerCompanyId: nextProviderCompanyId,
            status: dto.status ?? current.status,
            role: nextRole,
            locationMode: nextLocationMode,
            locationIds: persistedLocationIds,
            startsAt: nextStartsAt,
            endsAt: nextEndsAt,
            notes: dto.notes !== undefined ? dto.notes?.trim() || null : current.notes,
          },
        },
      })
      return updated.id
    })

    return this.getOne(updatedId)
  }

  async getLinkedClientAccess(providerCompanyId: string, clientCompanyId: string) {
    const normalizedProviderCompanyId = this.normalizeId(providerCompanyId)
    const normalizedClientCompanyId = this.normalizeId(clientCompanyId)
    if (!normalizedProviderCompanyId || !normalizedClientCompanyId) {
      return null
    }

    if (normalizedProviderCompanyId === normalizedClientCompanyId) {
      return {
        role: ServiceContractRole.PRIMARY,
        status: ServiceContractStatus.ACTIVE,
        locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
        effectiveLocationScope: { mode: 'tenant_wide' as const, locationIds: [] as string[] },
        clientCompanyId: normalizedClientCompanyId,
        providerCompanyId: normalizedProviderCompanyId,
        locations: [] as Array<{ locationId: string }>,
      }
    }

    const contract = await this.prisma.serviceContract.findUnique({
      where: {
        clientCompanyId_providerCompanyId: {
          clientCompanyId: normalizedClientCompanyId,
          providerCompanyId: normalizedProviderCompanyId,
        },
      },
      select: {
        id: true,
        status: true,
        role: true,
        locationMode: true,
        clientCompanyId: true,
        providerCompanyId: true,
        startsAt: true,
        endsAt: true,
        locations: { select: { locationId: true } },
      },
    })

    if (!contract || !isServiceContractEffective(contract)) {
      return null
    }

    const effectiveLocationScope = await this.resolveEffectiveLocationScope(contract)

    return {
      ...contract,
      effectiveLocationScope,
      locations: serviceContractLocationRowsFromScope(effectiveLocationScope),
    }
  }

  async assertPrimaryLinkedClientAccess(providerCompanyId: string, clientCompanyId: string) {
    const access = await this.getLinkedClientAccess(providerCompanyId, clientCompanyId)

    if (!access) {
      throw new NotFoundException('Linked client not found')
    }

    if (access.role !== ServiceContractRole.PRIMARY) {
      throw new BadRequestException('Linked client visibility is restricted for SECONDARY provider')
    }

    return access
  }

  async listPrimaryLinkedClientIds(providerCompanyId: string) {
    const normalizedProviderCompanyId = this.normalizeId(providerCompanyId)
    if (!normalizedProviderCompanyId) {
      return []
    }

    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        providerCompanyId: normalizedProviderCompanyId,
        ...activeServiceContractWhere(),
        role: ServiceContractRole.PRIMARY,
      },
      select: {
        clientCompanyId: true,
      },
    })

    return contracts
      .map((contract) => this.normalizeId(contract.clientCompanyId))
      .filter((companyId): companyId is string => !!companyId)
  }

  async listActiveLinkedClientIds(providerCompanyId: string, roles?: ServiceContractRole[]) {
    const normalizedProviderCompanyId = this.normalizeId(providerCompanyId)
    if (!normalizedProviderCompanyId) {
      return []
    }

    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        providerCompanyId: normalizedProviderCompanyId,
        ...activeServiceContractWhere(),
        ...(roles && roles.length > 0 ? { role: { in: roles } } : {}),
      },
      select: {
        clientCompanyId: true,
      },
    })

    return contracts
      .map((contract) => this.normalizeId(contract.clientCompanyId))
      .filter((companyId): companyId is string => !!companyId)
  }

  async listSecondaryLinkedClientIds(providerCompanyId: string): Promise<string[]> {
    const normalized = this.normalizeId(providerCompanyId)
    if (!normalized) return []

    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        providerCompanyId: normalized,
        ...activeServiceContractWhere(),
        role: ServiceContractRole.SECONDARY,
      },
      select: { clientCompanyId: true },
    })

    return contracts
      .map((c) => this.normalizeId(c.clientCompanyId))
      .filter((id): id is string => !!id)
  }

  async listSecondaryProviderCompanyIds(clientCompanyId: string): Promise<string[]> {
    const normalized = this.normalizeId(clientCompanyId)
    if (!normalized) return []

    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        clientCompanyId: normalized,
        ...activeServiceContractWhere(),
        role: ServiceContractRole.SECONDARY,
      },
      select: { providerCompanyId: true },
    })

    return contracts
      .map((c) => this.normalizeId(c.providerCompanyId))
      .filter((id): id is string => !!id)
  }

  private async validateContractParties(clientCompanyId: string, providerCompanyId: string) {
    if (clientCompanyId === providerCompanyId) {
      throw new BadRequestException('Client company and provider company must be different')
    }

    const companies = await this.prisma.company.findMany({
      where: { id: { in: [clientCompanyId, providerCompanyId] } },
      select: {
        id: true,
        name: true,
        type: true,
      },
    })

    const clientCompany = companies.find((company) => company.id === clientCompanyId)
    const providerCompany = companies.find((company) => company.id === providerCompanyId)

    if (!clientCompany) {
      throw new NotFoundException('Client company not found')
    }

    if (!providerCompany) {
      throw new NotFoundException('Provider company not found')
    }

    if (clientCompany.type !== CompanyType.CLIENT) {
      throw new BadRequestException('Client side must be a CLIENT company')
    }

    if (providerCompany.type !== CompanyType.PROVIDER) {
      throw new BadRequestException('Provider side must be a PROVIDER company')
    }
  }

  private resolveCreateLocationMode(
    requestedMode: ServiceContractLocationMode | undefined,
    locationIds: string[],
  ) {
    if (requestedMode) return requestedMode
    return locationIds.length > 0
      ? ServiceContractLocationMode.SELECTED_LOCATIONS
      : ServiceContractLocationMode.ALL_LOCATIONS
  }

  private resolveUpdateLocationMode(params: {
    currentRole: ServiceContractRole
    currentLocationMode: ServiceContractLocationMode
    nextRole: ServiceContractRole
    requestedLocationMode?: ServiceContractLocationMode
    explicitLocationIds?: string[]
  }) {
    if (params.requestedLocationMode) return params.requestedLocationMode
    if (params.explicitLocationIds !== undefined) {
      return params.explicitLocationIds.length > 0
        ? ServiceContractLocationMode.SELECTED_LOCATIONS
        : ServiceContractLocationMode.ALL_LOCATIONS
    }
    if (
      params.currentRole === ServiceContractRole.SECONDARY &&
      params.nextRole === ServiceContractRole.PRIMARY &&
      params.currentLocationMode === ServiceContractLocationMode.INHERIT_PRIMARY
    ) {
      return ServiceContractLocationMode.ALL_LOCATIONS
    }
    return params.currentLocationMode
  }

  private validateLocationMode(role: ServiceContractRole, locationMode: ServiceContractLocationMode) {
    if (role === ServiceContractRole.PRIMARY && locationMode === ServiceContractLocationMode.INHERIT_PRIMARY) {
      throw new BadRequestException('PRIMARY contract cannot inherit PRIMARY locations')
    }
  }

  private validateDates(startsAt?: string | null, endsAt?: string | null) {
    if (!startsAt || !endsAt) return
    this.validateDateValues(new Date(startsAt), new Date(endsAt))
  }

  private validateDateValues(startsAt?: Date | null, endsAt?: Date | null) {
    if (!startsAt || !endsAt) return
    if (startsAt.getTime() > endsAt.getTime()) {
      throw new BadRequestException('startsAt must be earlier than or equal to endsAt')
    }
  }

  private normalizeIds(values?: string[] | null) {
    return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)))
  }

  private async assertContractUnique(clientCompanyId: string, providerCompanyId: string, excludeId?: string) {
    const existing = await this.prisma.serviceContract.findUnique({
      where: {
        clientCompanyId_providerCompanyId: {
          clientCompanyId,
          providerCompanyId,
        },
      },
      select: { id: true },
    })
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException('Service contract already exists for this client and provider')
    }
  }

  private async assertLocationsBelongToClient(clientCompanyId: string, locationIds: string[]) {
    if (locationIds.length === 0) return
    const rows = await this.prisma.location.findMany({
      where: {
        id: { in: locationIds },
        clientCompanyId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    })
    const found = new Set(rows.map((row) => row.id))
    const rejected = locationIds.filter((id) => !found.has(id))
    if (rejected.length > 0) {
      throw new BadRequestException('Some locations do not belong to the contract client')
    }
  }

  private async ensureCompanyExists(companyId: string) {
    const normalizedCompanyId = this.normalizeId(companyId)
    if (!normalizedCompanyId) {
      throw new NotFoundException('Company not found')
    }

    const company = await this.prisma.company.findUnique({
      where: { id: normalizedCompanyId },
      select: { id: true },
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }
  }

  private async resolvePrimaryInheritanceSource(
    clientCompanyId: string,
    excludeContractId?: string,
  ): Promise<{ hasPrimarySource: boolean; inheritedLocationIds: string[] | null }> {
    const primaryContracts = await this.prisma.serviceContract.findMany({
      where: {
        clientCompanyId,
        ...activeServiceContractWhere(),
        role: ServiceContractRole.PRIMARY,
        ...(excludeContractId ? { id: { not: excludeContractId } } : {}),
      },
      select: {
        locationMode: true,
        locations: { select: { locationId: true } },
      },
    })

    if (primaryContracts.length === 0) {
      return { hasPrimarySource: false, inheritedLocationIds: [] }
    }

    const inherited = new Set<string>()
    for (const contract of primaryContracts) {
      const scope = resolveServiceContractLocationScope({
        locationMode: contract.locationMode,
        locationIds: contract.locations.map((row) => row.locationId),
      })
      if (scope.mode === 'tenant_wide') {
        return { hasPrimarySource: true, inheritedLocationIds: null }
      }
      for (const locationId of scope.locationIds) {
        inherited.add(locationId)
      }
    }

    return { hasPrimarySource: true, inheritedLocationIds: Array.from(inherited) }
  }

  private async resolveEffectiveLocationScope(contract: {
    id?: string
    clientCompanyId: string
    locationMode?: ServiceContractLocationMode | null
    locations?: Array<{ locationId: string }> | null
  }): Promise<ResolvedServiceContractLocationScope> {
    if (contract.locationMode === ServiceContractLocationMode.INHERIT_PRIMARY) {
      const inherited = await this.resolvePrimaryInheritanceSource(contract.clientCompanyId, contract.id)
      return resolveServiceContractLocationScope({
        locationMode: contract.locationMode,
        locationIds: contract.locations?.map((row) => row.locationId) ?? [],
        inheritedLocationIds: inherited.inheritedLocationIds,
        hasPrimarySource: inherited.hasPrimarySource,
      })
    }

    return resolveServiceContractLocationScope({
      locationMode: contract.locationMode,
      locationIds: contract.locations?.map((row) => row.locationId) ?? [],
    })
  }

  private async enrichContract<T extends {
    clientCompany: { id: string }
    clientCompanyId?: string
    locationMode?: ServiceContractLocationMode | null
    locations?: Array<{ locationId: string }>
  }>(contract: T) {
    const clientCompanyId = contract.clientCompanyId ?? contract.clientCompany.id
    const effectiveLocationScope = await this.resolveEffectiveLocationScope({
      ...(contract as any),
      clientCompanyId,
    })
    const totalLocations = await this.prisma.location.count({
      where: { clientCompanyId, isActive: true, deletedAt: null },
    })
    const selectedLocations = uniqueServiceContractLocationIds(contract.locations?.map((row) => row.locationId)).length
    const effectiveLocations =
      effectiveLocationScope.mode === 'tenant_wide'
        ? totalLocations
        : effectiveLocationScope.locationIds.length

    return {
      ...contract,
      locationMode: contract.locationMode ?? ServiceContractLocationMode.ALL_LOCATIONS,
      effectiveLocationScope,
      locationSummary: {
        mode: contract.locationMode ?? ServiceContractLocationMode.ALL_LOCATIONS,
        totalLocations,
        selectedLocations,
        effectiveLocations,
      },
    }
  }

  private async enrichContracts<T extends {
    clientCompany: { id: string }
    clientCompanyId?: string
    locationMode?: ServiceContractLocationMode | null
    locations?: Array<{ locationId: string }>
  }>(contracts: T[]) {
    const clientCompanyIds = uniqueServiceContractLocationIds(
      contracts.map((contract) => contract.clientCompanyId ?? contract.clientCompany.id),
    )
    const totals = clientCompanyIds.length
      ? await this.prisma.location.groupBy({
          by: ['clientCompanyId'],
          where: {
            clientCompanyId: { in: clientCompanyIds },
            isActive: true,
            deletedAt: null,
          },
          _count: { _all: true },
        })
      : []
    const totalByClientId = new Map(totals.map((row) => [row.clientCompanyId, row._count._all]))

    return Promise.all(contracts.map(async (contract) => {
      const clientCompanyId = contract.clientCompanyId ?? contract.clientCompany.id
      const effectiveLocationScope = await this.resolveEffectiveLocationScope({
        ...(contract as any),
        clientCompanyId,
      })
      const totalLocations = totalByClientId.get(clientCompanyId) ?? 0
      const selectedLocations = uniqueServiceContractLocationIds(contract.locations?.map((row) => row.locationId)).length
      const effectiveLocations =
        effectiveLocationScope.mode === 'tenant_wide'
          ? totalLocations
          : effectiveLocationScope.locationIds.length

      return {
        ...contract,
        locationMode: contract.locationMode ?? ServiceContractLocationMode.ALL_LOCATIONS,
        effectiveLocationScope,
        locationSummary: {
          mode: contract.locationMode ?? ServiceContractLocationMode.ALL_LOCATIONS,
          totalLocations,
          selectedLocations,
          effectiveLocations,
        },
      }
    }))
  }

  private async recordContractAuditTx(
    tx: any,
    params: {
      type: 'service_contract.created' | 'service_contract.updated'
      companyId: string
      entityId: string
      actorUserId?: string | null
      payload: Record<string, unknown>
    },
  ) {
    await tx.domainEvent.create({
      data: {
        companyId: params.companyId,
        entityType: 'ServiceContract',
        entityId: params.entityId,
        type: params.type,
        actorUserId: params.actorUserId ?? null,
        payload: params.payload as any,
      },
    })
  }

  private contractSelect() {
    return {
      id: true,
      clientCompanyId: true,
      providerCompanyId: true,
      status: true,
      role: true,
      locationMode: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      clientCompany: {
        select: {
          id: true,
          name: true,
          type: true,
          publicRequestEnabled: true,
        },
      },
      providerCompany: {
        select: {
          id: true,
          name: true,
          type: true,
          publicRequestEnabled: true,
        },
      },
      locations: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          locationId: true,
          location: {
            select: { id: true, name: true, address: true, platformCode: true },
          },
        },
      },
    }
  }
}
