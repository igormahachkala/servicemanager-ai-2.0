import { Injectable } from '@nestjs/common'
import { ServiceContractLocationMode, ServiceContractRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'

import {
  resolveServiceContractLocationScope,
  type ResolvedServiceContractLocationScope,
} from './service-contract-location-scope'
import { activeServiceContractWhere } from './service-contract-window'

export type ContractSpecializationScope =
  | { mode: 'EXPLICIT'; specializationIds: string[] }
  | { mode: 'UNCONFIGURED'; specializationIds: [] }

export type ContractContextInput = {
  actorCompanyId?: string | null
  providerCompanyId?: string | null
  clientCompanyId?: string | null
  linkedClientCompanyId?: string | null
  ticketId?: string | null
}

export type ContractContext = {
  contractId: string
  serviceContractId: string
  clientCompanyId: string
  providerCompanyId: string
  roleInContract: ServiceContractRole
  locationMode: ServiceContractLocationMode
  locationIds: string[]
  specializationMode: ContractSpecializationScope['mode']
  specializationIds: string[]
  contractLocationScope: ResolvedServiceContractLocationScope
  contractSpecializationScope: ContractSpecializationScope
}

type ContractLocationCarrier = {
  id: string
  clientCompanyId: string
  providerCompanyId: string
  role: ServiceContractRole
  locationMode: ServiceContractLocationMode | null
  locations: Array<{ locationId: string }>
}

@Injectable()
export class ContractContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getContractContext(input: ContractContextInput): Promise<ContractContext | null> {
    const providerCompanyId = this.normalizeId(input.providerCompanyId) ?? this.normalizeId(input.actorCompanyId)
    const explicitClientCompanyId =
      this.normalizeId(input.clientCompanyId) ?? this.normalizeId(input.linkedClientCompanyId)
    const clientCompanyId = explicitClientCompanyId ?? await this.resolveTicketClientCompanyId(input.ticketId)

    if (!providerCompanyId || !clientCompanyId) {
      return null
    }

    const contract = await this.prisma.serviceContract.findFirst({
      where: {
        providerCompanyId,
        clientCompanyId,
        ...activeServiceContractWhere(),
      },
      select: this.contractSelect(),
    })

    if (!contract) {
      return null
    }

    return this.buildContractContext(contract)
  }

  async getContractLocationScope(serviceContractId: string): Promise<ResolvedServiceContractLocationScope | null> {
    const normalizedId = this.normalizeId(serviceContractId)
    if (!normalizedId) {
      return null
    }

    const contract = await this.prisma.serviceContract.findFirst({
      where: {
        id: normalizedId,
        ...activeServiceContractWhere(),
      },
      select: this.contractSelect(),
    })

    if (!contract) {
      return null
    }

    return this.resolveEffectiveLocationScope(contract)
  }

  async getContractSpecializationScope(serviceContractId: string): Promise<ContractSpecializationScope> {
    const normalizedId = this.normalizeId(serviceContractId)
    if (!normalizedId) {
      return { mode: 'UNCONFIGURED', specializationIds: [] }
    }

    const rows = await this.prisma.serviceContractSpecialization.findMany({
      where: { serviceContractId: normalizedId },
      orderBy: [{ createdAt: 'asc' }, { specializationId: 'asc' }],
      select: { specializationId: true },
    })
    const specializationIds = this.uniqueIds(rows.map((row) => row.specializationId))

    if (specializationIds.length === 0) {
      return { mode: 'UNCONFIGURED', specializationIds: [] }
    }

    return { mode: 'EXPLICIT', specializationIds }
  }

  private async resolveTicketClientCompanyId(ticketId?: string | null): Promise<string | null> {
    const normalizedTicketId = this.normalizeId(ticketId)
    if (!normalizedTicketId) {
      return null
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: normalizedTicketId },
      select: { companyId: true },
    })

    return this.normalizeId(ticket?.companyId)
  }

  private async buildContractContext(contract: ContractLocationCarrier): Promise<ContractContext> {
    const contractLocationScope = await this.resolveEffectiveLocationScope(contract)
    const contractSpecializationScope = await this.getContractSpecializationScope(contract.id)
    const locationMode = contract.locationMode ?? ServiceContractLocationMode.ALL_LOCATIONS

    return {
      contractId: contract.id,
      serviceContractId: contract.id,
      clientCompanyId: contract.clientCompanyId,
      providerCompanyId: contract.providerCompanyId,
      roleInContract: contract.role,
      locationMode,
      locationIds: contractLocationScope.locationIds,
      specializationMode: contractSpecializationScope.mode,
      specializationIds: contractSpecializationScope.specializationIds,
      contractLocationScope,
      contractSpecializationScope,
    }
  }

  private async resolveEffectiveLocationScope(
    contract: ContractLocationCarrier,
  ): Promise<ResolvedServiceContractLocationScope> {
    if (contract.locationMode === ServiceContractLocationMode.INHERIT_PRIMARY) {
      const inherited = await this.resolvePrimaryInheritanceSource(contract.clientCompanyId, contract.id)

      return resolveServiceContractLocationScope({
        locationMode: contract.locationMode,
        locationIds: contract.locations.map((row) => row.locationId),
        inheritedLocationIds: inherited.inheritedLocationIds,
        hasPrimarySource: inherited.hasPrimarySource,
      })
    }

    return resolveServiceContractLocationScope({
      locationMode: contract.locationMode,
      locationIds: contract.locations.map((row) => row.locationId),
    })
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

  private normalizeId(value?: string | null): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private uniqueIds(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
  }

  private contractSelect() {
    return {
      id: true,
      clientCompanyId: true,
      providerCompanyId: true,
      role: true,
      locationMode: true,
      locations: {
        orderBy: { createdAt: 'asc' as const },
        select: { locationId: true },
      },
    }
  }
}
