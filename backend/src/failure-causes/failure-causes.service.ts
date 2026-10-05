import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { CompanyType, Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { resolveReadableTicketAccess, type TicketAccessActor } from '../tickets/ticket-access.utils'
import { CreateFailureCauseDto } from './dto/create-failure-cause.dto'
import { UpdateFailureCauseDto } from './dto/update-failure-cause.dto'

@Injectable()
export class FailureCausesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async listOwn(companyId: string, active?: string) {
    const activeFilter =
      typeof active === 'string' && active.trim()
        ? active.trim().toLowerCase() === 'true'
        : undefined

    return this.prisma.failureCause.findMany({
      where: {
        companyId,
        active: activeFilter,
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async listActiveForTicket(
    actor: TicketAccessActor,
    ticketId: string,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    const readable = await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor,
      ticketId,
      linkedClientCompanyId,
      observerCompanyId,
    })

    return this.prisma.failureCause.findMany({
      where: {
        companyId: readable.ticket.companyId,
        active: true,
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async create(companyId: string, dto: CreateFailureCauseDto) {
    await this.assertOwnClientCompany(companyId)
    const name = this.normalizeName(dto.name)

    try {
      return await this.prisma.failureCause.create({
        data: {
          companyId,
          name,
          active: typeof dto.active === 'boolean' ? dto.active : true,
        },
      })
    } catch (error) {
      this.rethrowDuplicateName(error)
      throw error
    }
  }

  async update(companyId: string, id: string, dto: UpdateFailureCauseDto) {
    await this.assertOwnClientCompany(companyId)
    const existing = await this.prisma.failureCause.findFirst({
      where: { id, companyId },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundException('Failure cause not found')
    }

    const data: Prisma.FailureCauseUpdateInput = {}
    if (dto.name !== undefined) {
      data.name = this.normalizeName(dto.name)
    }
    if (typeof dto.active === 'boolean') {
      data.active = dto.active
    }

    if (Object.keys(data).length === 0) {
      return this.prisma.failureCause.findUniqueOrThrow({ where: { id } })
    }

    try {
      return await this.prisma.failureCause.update({
        where: { id },
        data,
      })
    } catch (error) {
      this.rethrowDuplicateName(error)
      throw error
    }
  }

  setStatus(companyId: string, id: string, active: boolean) {
    return this.update(companyId, id, { active })
  }

  private normalizeName(name: string | undefined) {
    const normalized = (name ?? '').trim()
    if (!normalized) {
      throw new BadRequestException('name is required')
    }
    return normalized
  }

  private async assertOwnClientCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, type: true },
    })
    if (!company) {
      throw new NotFoundException('Company not found')
    }
    if (company.type !== CompanyType.CLIENT) {
      throw new ForbiddenException('Failure cause dictionary belongs to the client company')
    }
  }

  private rethrowDuplicateName(error: unknown): never | void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException('Failure cause with this name already exists')
    }
  }
}
