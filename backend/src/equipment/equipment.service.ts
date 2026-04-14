import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { EquipmentRepository } from './equipment.repository';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isLocationAllowedByScope, resolveUserLocationScope } from '../policy/location-scope.utils';

@Injectable()
export class EquipmentService {
  constructor(private readonly repo: EquipmentRepository, private readonly prisma: PrismaService) {}

  private async assertLocationScope(
    companyId: string,
    userId: string,
    role: UserRole,
    locationId: string,
  ) {
    const locationScope = await resolveUserLocationScope({
      prisma: this.prisma,
      actorCompanyId: companyId,
      userId,
      role,
      scopeCompanyId: companyId,
    });
    if (!isLocationAllowedByScope(locationScope, locationId)) {
      throw new NotFoundException('Location not found');
    }
  }

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

  async findAllByLocation(companyId: string, userId: string, role: UserRole, locationId: string) {
    await this.assertLocationScope(companyId, userId, role, locationId);
    const location = await this.repo.findLocation(companyId, locationId);
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return this.repo.findAllByLocation(companyId, locationId);
  }

  async findOne(companyId: string, userId: string | null, role: UserRole | null, id: string) {
    const equipment = await this.repo.findOne(companyId, id);
    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }
    if (userId && role) {
      await this.assertLocationScope(companyId, userId, role, equipment.locationId);
    }

    return equipment;
  }

  async update(companyId: string, id: string, dto: UpdateEquipmentDto) {
    await this.findOne(companyId, null, null, id);

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
    await this.findOne(companyId, null, null, id);

    return this.repo.update(id, {
      status: 'INACTIVE',
    });
  }
}