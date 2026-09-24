import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * SMA-EQUIPMENT-V2-110A.
 *
 * Область площадок пользователя и явный фильтр «Точка» — разные условия,
 * и действовать обязаны оба. Сначала они писались двумя спредами в один ключ
 * locationId, и второй молча затирал первый: у пользователя, привязанного
 * к нескольким площадкам, выбор точки в интерфейсе не менял ничего.
 * Область при этом всегда побеждала, поэтому доступ не расширялся — ломался
 * отбор. Обнаружено на приёмке Stage 110A: фильтр по площадке вернул весь парк.
 *
 * Запрошенная площадка вне области даёт пустую выдачу, а не выдачу по области:
 * иначе фильтр «покажи точку, которую мне не видно» тихо показал бы соседние.
 */
function locationWhere(scopedIds?: string[], requested?: string) {
  const wanted = (requested || '').trim();
  if (!wanted) {
    return scopedIds ? { locationId: { in: scopedIds } } : {};
  }
  if (scopedIds && !scopedIds.includes(wanted)) {
    return { locationId: { in: [] as string[] } };
  }
  return { locationId: wanted };
}

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
    // SMA-EQUIPMENT-V2-110A: паспорт карточки.
    manufacturer: true,
    model: true,
    serialNumber: true,
    inventoryNumber: true,
    commissionedAt: true,
    warrantyUntil: true,
    description: true,
    mainPhotoId: true,
    mainPhoto: {
      select: { id: true, url: true, originalName: true, mimeType: true },
    },
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

  findLocationById(locationId: string) {
    return this.prisma.location.findUnique({
      where: { id: locationId },
      select: {
        id: true,
        clientCompanyId: true,
        isActive: true,
      },
    });
  }

  /**
   * SMA-EQUIPMENT-V2-110A.
   * Список по компании с поиском и фильтрами. Отбор идёт в базе, а не в браузере:
   * иначе поиск по серийному номеру означал бы выгрузку всего парка на клиент.
   */
  findAllByCompany(
    companyId: string,
    params: { locationIds?: string[]; locationId?: string; status?: string; search?: string; take?: number },
  ) {
    const search = (params.search || '').trim();
    return this.prisma.equipment.findMany({
      where: {
        companyId,
        ...locationWhere(params.locationIds, params.locationId),
        ...(params.status ? { status: params.status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { manufacturer: { contains: search, mode: 'insensitive' as const } },
                { model: { contains: search, mode: 'insensitive' as const } },
                { serialNumber: { contains: search, mode: 'insensitive' as const } },
                { inventoryNumber: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: this.select,
      orderBy: [{ status: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
      take: params.take ?? 200,
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

  findOneById(id: string) {
    return this.prisma.equipment.findUnique({
      where: { id },
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
