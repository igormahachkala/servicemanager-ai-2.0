import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyType, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { resolveObserverScopeCompanyId } from '../policy/policy.utils';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { isLocationAllowedByLocationScope, resolveActorLocationScope } from '../tickets/ticket-access.utils';
import { EquipmentRepository } from './equipment.repository';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly repo: EquipmentRepository,
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async create(companyId: string, dto: CreateEquipmentDto) {
    const name = dto.name.trim();
    const type = dto.type.trim().toUpperCase();

    if (!name) {
      throw new BadRequestException('name is required');
    }

    if (!type) {
      throw new BadRequestException('type is required');
    }

    const location = await this.repo.findLocation(companyId, dto.locationId);
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return this.repo.create({
      companyId,
      locationId: location.id,
      name,
      type,
      status: 'ACTIVE',
    });
  }

  async findAllByLocation(
    companyId: string,
    actorUserId: string,
    actorRole: UserRole,
    locationId: string,
    requestedCompanyId?: string,
  ) {
    const scopeCompanyId = await this.resolveReadableCompanyId(companyId, actorRole, requestedCompanyId)
    const locationScope = await resolveActorLocationScope({
      prisma: this.prisma,
      actor: {
        id: actorUserId,
        role: actorRole,
        companyId,
      },
      scopeCompanyId,
    });
    if (!isLocationAllowedByLocationScope(locationScope, locationId)) {
      throw new NotFoundException('Location not found');
    }

    const location = await this.repo.findLocation(scopeCompanyId, locationId);
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return this.repo.findAllByLocation(scopeCompanyId, locationId);
  }

  async findOne(companyId: string, actorUserId: string, actorRole: UserRole, id: string, requestedCompanyId?: string) {
    const scopeCompanyId = await this.resolveReadableCompanyId(companyId, actorRole, requestedCompanyId)
    const equipment = await this.repo.findOne(scopeCompanyId, id);
    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }

    const locationScope = await resolveActorLocationScope({
      prisma: this.prisma,
      actor: {
        id: actorUserId,
        role: actorRole,
        companyId,
      },
      scopeCompanyId,
    });
    if (!isLocationAllowedByLocationScope(locationScope, equipment.locationId)) {
      throw new NotFoundException('Equipment not found');
    }

    return equipment;
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
        select: { type: true },
      })
      if (!company) {
        throw new NotFoundException('Company not found')
      }
      if (company.type !== CompanyType.CLIENT) {
        throw new BadRequestException('Observer scope must be a CLIENT company')
      }
      return observerCompanyId
    }

    const linkedAccess = await this.serviceContractsService.getLinkedClientAccess(actorCompanyId, requested)
    if (!linkedAccess) {
      throw new NotFoundException('Linked client not found')
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

  async update(companyId: string, id: string, dto: UpdateEquipmentDto) {
    const existing = await this.repo.findOne(companyId, id);
    if (!existing) {
      throw new NotFoundException('Equipment not found');
    }

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('name cannot be empty');
    }

    const nextType = dto.type !== undefined ? dto.type.trim().toUpperCase() : undefined;
    if (nextType !== undefined && !nextType) {
      throw new BadRequestException('type cannot be empty');
    }

    const nextStatus = dto.status !== undefined ? dto.status.trim().toUpperCase() : undefined;
    if (nextStatus !== undefined && !nextStatus) {
      throw new BadRequestException('status cannot be empty');
    }

    return this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(nextType !== undefined ? { type: nextType } : {}),
      ...(nextStatus !== undefined ? { status: nextStatus } : {}),
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await this.repo.findOne(companyId, id);
    if (!existing) {
      throw new NotFoundException('Equipment not found');
    }

    return this.repo.update(id, {
      status: 'INACTIVE',
    });
  }
}
