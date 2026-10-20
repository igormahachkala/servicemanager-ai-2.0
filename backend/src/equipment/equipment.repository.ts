import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EquipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly select = {
    id: true,
    companyId: true,
    locationId: true,
    name: true,
    type: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    location: {
      select: {
        id: true,
        name: true,
        platformCode: true,
        city: true,
        address: true,
        isActive: true,
      },
    },
  } satisfies Prisma.EquipmentSelect;

  findLocation(companyId: string, locationId: string) {
    return this.prisma.location.findFirst({
      where: {
        id: locationId,
        clientCompanyId: companyId,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });
  }

  findAllByLocation(companyId: string, locationId: string) {
    return this.prisma.equipment.findMany({
      where: {
        companyId,
        locationId,
      },
      select: this.select,
      orderBy: [{ status: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findOne(companyId: string, id: string) {
    return this.prisma.equipment.findFirst({
      where: {
        id,
        companyId,
      },
      select: this.select,
    });
  }

  create(data: Prisma.EquipmentUncheckedCreateInput) {
    return this.prisma.equipment.create({
      data,
      select: this.select,
    });
  }

  update(id: string, data: Prisma.EquipmentUncheckedUpdateInput) {
    return this.prisma.equipment.update({
      where: { id },
      data,
      select: this.select,
    });
  }
}