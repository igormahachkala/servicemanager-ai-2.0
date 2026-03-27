import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CompanyType, ServiceContractRole, ServiceContractStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'

import { CreateServiceContractDto } from './dto/create-service-contract.dto'
import { UpdateServiceContractDto } from './dto/update-service-contract.dto'

@Injectable()
export class ServiceContractsService {
  constructor(private prisma: PrismaService) {}

  async listAll() {
    return this.prisma.serviceContract.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: this.contractSelect(),
    })
  }

  async listForCompany(companyId: string) {
    await this.ensureCompanyExists(companyId)

    return this.prisma.serviceContract.findMany({
      where: {
        OR: [{ clientCompanyId: companyId }, { providerCompanyId: companyId }],
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: this.contractSelect(),
    })
  }

  async listLinkedClients(providerCompanyId: string) {
    await this.ensureCompanyExists(providerCompanyId)

    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        providerCompanyId,
        status: ServiceContractStatus.ACTIVE,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: this.contractSelect(),
    })

    const clientCompanyIds = contracts.map((contract) => contract.clientCompany.id)
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

    return contracts.map((contract) => ({
      ...contract,
      summary: {
        openTickets: openTicketCountByCompanyId.get(contract.clientCompany.id) ?? 0,
        locations: locationCountByCompanyId.get(contract.clientCompany.id) ?? 0,
        publicRequestEnabled: contract.clientCompany.publicRequestEnabled,
      },
    }))
  }

  async listLinkedProviders(clientCompanyId: string) {
    await this.ensureCompanyExists(clientCompanyId)

    return this.prisma.serviceContract.findMany({
      where: {
        clientCompanyId,
        status: ServiceContractStatus.ACTIVE,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: this.contractSelect(),
    })
  }

  async getOne(id: string) {
    const contract = await this.prisma.serviceContract.findUnique({
      where: { id },
      select: this.contractSelect(),
    })

    if (!contract) {
      throw new NotFoundException('Service contract not found')
    }

    return contract
  }

  async create(dto: CreateServiceContractDto) {
    await this.validateContractParties(dto.clientCompanyId, dto.providerCompanyId)
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

    return this.prisma.serviceContract.create({
      data: {
        clientCompanyId: dto.clientCompanyId,
        providerCompanyId: dto.providerCompanyId,
        status: dto.status ?? ServiceContractStatus.DRAFT,
        role: dto.role ?? ServiceContractRole.PRIMARY,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        notes: dto.notes?.trim() || null,
      },
      select: this.contractSelect(),
    })
  }

  async update(id: string, dto: UpdateServiceContractDto) {
    await this.getOne(id)
    this.validateDates(dto.startsAt, dto.endsAt)

    return this.prisma.serviceContract.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
      select: this.contractSelect(),
    })
  }

  async getLinkedClientAccess(providerCompanyId: string, clientCompanyId: string) {
    if (providerCompanyId === clientCompanyId) {
      return {
        role: ServiceContractRole.PRIMARY,
        status: ServiceContractStatus.ACTIVE,
        clientCompanyId,
        providerCompanyId,
      }
    }

    const contract = await this.prisma.serviceContract.findUnique({
      where: {
        clientCompanyId_providerCompanyId: {
          clientCompanyId,
          providerCompanyId,
        },
      },
      select: {
        id: true,
        status: true,
        role: true,
        clientCompanyId: true,
        providerCompanyId: true,
      },
    })

    if (!contract || contract.status !== ServiceContractStatus.ACTIVE) {
      return null
    }

    return contract
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
    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        providerCompanyId,
        status: ServiceContractStatus.ACTIVE,
        role: ServiceContractRole.PRIMARY,
      },
      select: {
        clientCompanyId: true,
      },
    })

    return contracts.map((contract) => contract.clientCompanyId)
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

  private validateDates(startsAt?: string | null, endsAt?: string | null) {
    if (!startsAt || !endsAt) return
    if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      throw new BadRequestException('startsAt must be earlier than or equal to endsAt')
    }
  }

  private async ensureCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }
  }

  private contractSelect() {
    return {
      id: true,
      status: true,
      role: true,
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
    }
  }
}
