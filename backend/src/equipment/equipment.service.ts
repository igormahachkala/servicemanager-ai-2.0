import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyType, UserRole } from '@prisma/client';

import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';

import { PrismaService } from '../prisma/prisma.service';
import { resolveObserverScopeCompanyId } from '../policy/policy.utils';
import { isServiceContractLocationAllowed } from '../service-contracts/service-contract-location-scope';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import {
  isLocationAllowedByLocationScope,
  resolveActorLocationScope,
} from '../tickets/ticket-access.utils';
import { EquipmentRepository } from './equipment.repository';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

/**
 * SMA-EQUIPMENT-V2-110A.
 *
 * Допустимые статусы. Перечисление намеренно живёт здесь, а не в enum Prisma:
 * INACTIVE несёт мягкое удаление (remove ниже), и заменить набор на
 * ACTIVE/REPAIR/DECOMMISSIONED нельзя, не решив продуктово, одно ли это
 * состояние со списанием. До этого решения проверка идёт на сервисе, а колонка
 * остаётся TEXT — это обратимо, в отличие от enum в базе.
 */
export const EQUIPMENT_STATUSES = ['ACTIVE', 'INACTIVE', 'REPAIR', 'DECOMMISSIONED'] as const;

export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

/** Пустая строка в необязательном поле означает «очистить», а не «не менять». */
function optionalText(value: string | undefined, max = 4000): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function optionalDate(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Некорректная дата');
  }
  return parsed;
}

@Injectable()
export class EquipmentService {
  constructor(
    private readonly repo: EquipmentRepository,
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async create(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    dto: CreateEquipmentDto,
  ) {
    const name = dto.name.trim();
    const type = dto.type.trim().toUpperCase();

    if (!name) {
      throw new BadRequestException('name is required');
    }

    if (!type) {
      throw new BadRequestException('type is required');
    }

    const location = await this.assertWritableLocation({
      actorCompanyId,
      actorUserId,
      actorRole,
      locationId: dto.locationId,
    });

    const manufacturer = optionalText(dto.manufacturer, 200);
    const model = optionalText(dto.model, 200);
    const serialNumber = optionalText(dto.serialNumber, 200);
    const inventoryNumber = optionalText(dto.inventoryNumber, 200);
    const commissionedAt = optionalDate(dto.commissionedAt);
    const warrantyUntil = optionalDate(dto.warrantyUntil);
    const description = optionalText(dto.description);

    return this.repo.create({
      // Владелец — всегда компания площадки. Провайдер оператор, но не владелец.
      companyId: location.clientCompanyId,
      locationId: location.id,
      name,
      type,
      status: 'ACTIVE',
      // Пишутся только переданные поля — так же, как в update. Ненаписанное
      // остаётся NULL по умолчанию колонки.
      ...(manufacturer !== undefined ? { manufacturer } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(serialNumber !== undefined ? { serialNumber } : {}),
      ...(inventoryNumber !== undefined ? { inventoryNumber } : {}),
      ...(commissionedAt !== undefined ? { commissionedAt } : {}),
      ...(warrantyUntil !== undefined ? { warrantyUntil } : {}),
      ...(description !== undefined ? { description } : {}),
    });
  }

  /**
   * SMA-EQUIPMENT-V2-110A.
   * Список оборудования компании с поиском и фильтрами. Доступ решает тот же
   * resolveReadableCompanyId + областная видимость площадок, что и остальной
   * модуль: своего резолвера здесь нет.
   */
  async findAllByCompany(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    params: {
      companyId?: string;
      locationId?: string;
      status?: string;
      search?: string;
    },
  ) {
    const scopeCompanyId = await this.resolveReadableCompanyId(
      actorCompanyId,
      actorRole,
      params.companyId,
    );

    const locationScope = await resolveActorLocationScope({
      prisma: this.prisma,
      actor: { id: actorUserId, role: actorRole, companyId: actorCompanyId },
      scopeCompanyId,
    });

    // Пользователь, привязанный к конкретным площадкам, не должен видеть парк
    // соседних: ограничение переносится в запрос, а не в отображение.
    const locationIds =
      locationScope.mode === 'tenant_wide' ? undefined : locationScope.locationIds;
    if (locationIds && locationIds.length === 0) {
      return [];
    }

    const status = (params.status || '').trim().toUpperCase();
    if (status && !(EQUIPMENT_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException('Недопустимый статус оборудования');
    }

    return this.repo.findAllByCompany(scopeCompanyId, {
      locationIds,
      locationId: params.locationId,
      status: status || undefined,
      search: params.search,
    });
  }

  /**
   * Загрузка снимка. Хранилище и раздача — общие: файл ложится в тот же
   * uploads/, а отдаётся авторизованным маршрутом /uploads/:folder/:filename.
   * Своего хранилища и публичных путей не появляется.
   */
  async uploadPhoto(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    equipmentId: string,
    file: any,
  ) {
    // Право на запись — та же проверка, что у create/update: SECONDARY сюда не пройдёт.
    const existing = await this.assertWritableEquipment(
      actorCompanyId,
      actorUserId,
      actorRole,
      equipmentId,
    );

    this.assertImageFile(file);
    const stored = await this.persistFile(file);

    const attachment = await this.prisma.equipmentAttachment.create({
      data: {
        companyId: existing.companyId,
        equipmentId,
        uploadedByUserId: actorUserId,
        originalName: String(file.originalname || 'photo'),
        storageKey: stored.storageKey,
        mimeType: String(file.mimetype || 'application/octet-stream'),
        sizeBytes: Number(file.size || 0),
        url: stored.url,
      },
      select: { id: true, url: true, originalName: true, mimeType: true, createdAt: true },
    });

    // Первый снимок сразу становится обложкой: иначе карточка остаётся без фото,
    // пока пользователь отдельно её не выберет.
    if (!existing.mainPhotoId) {
      await this.repo.update(equipmentId, { mainPhotoId: attachment.id });
    }

    return attachment;
  }

  private static readonly ALLOWED_PHOTO_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ]);

  private assertImageFile(file: any) {
    if (!file) throw new BadRequestException('file is required');
    const mime = String(file.mimetype || '').toLowerCase();
    if (!EquipmentService.ALLOWED_PHOTO_MIME_TYPES.has(mime)) {
      throw new BadRequestException(
        'Поддерживаются изображения JPEG, PNG, WebP, HEIC и HEIF',
      );
    }
    if (!file.buffer || !file.size) {
      throw new BadRequestException('Загруженный файл пуст');
    }
  }

  private readonly uploadsDir = join(process.cwd(), 'uploads', 'equipment');

  private async persistFile(file: any) {
    await mkdir(this.uploadsDir, { recursive: true });
    const ext = extname(file.originalname || '') || '.bin';
    const storageKey = `${randomUUID()}${ext}`;
    await writeFile(join(this.uploadsDir, storageKey), file.buffer);
    return { storageKey, url: `/uploads/equipment/${storageKey}` };
  }

  /**
   * SMA-EQUIPMENT-HISTORY-PARTS-110B.
   *
   * Канонический шлюз записи по единице оборудования. Ровно эта преамбула
   * повторялась в update, remove и uploadPhoto; теперь она одна, и модуль
   * комплектующих ходит через неё же. Второго резолвера доступа не заводится:
   * SECONDARY-провайдер сюда не проходит, потому что внутри
   * assertPrimaryLinkedClientAccess.
   */
  async assertWritableEquipment(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    equipmentId: string,
  ) {
    const existing = await this.repo.findOneById(equipmentId);
    if (!existing) {
      throw new NotFoundException('Equipment not found');
    }

    const location = await this.assertWritableLocation({
      actorCompanyId,
      actorUserId,
      actorRole,
      locationId: existing.locationId,
    });
    if (existing.companyId !== location.clientCompanyId) {
      throw new NotFoundException('Equipment not found');
    }

    return existing;
  }

  async findAllByLocation(
    companyId: string,
    actorUserId: string,
    actorRole: UserRole,
    locationId: string,
    requestedCompanyId?: string,
  ) {
    const scopeCompanyId = await this.resolveReadableCompanyId(
      companyId,
      actorRole,
      requestedCompanyId,
    );
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

  async findOne(
    companyId: string,
    actorUserId: string,
    actorRole: UserRole,
    id: string,
    requestedCompanyId?: string,
  ) {
    const scopeCompanyId = await this.resolveReadableCompanyId(
      companyId,
      actorRole,
      requestedCompanyId,
    );
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
    if (
      !isLocationAllowedByLocationScope(locationScope, equipment.locationId)
    ) {
      throw new NotFoundException('Equipment not found');
    }

    return equipment;
  }

  /**
   * SMA-EQUIPMENT-HISTORY-PARTS-110B: стал публичным — тем же разрешением
   * контура пользуется справочник комплектующих. Правило одно на модуль.
   */
  async resolveReadableCompanyId(
    actorCompanyId: string,
    actorRole: UserRole,
    requestedCompanyId?: string,
  ) {
    const requested = (requestedCompanyId || '').trim();
    if (!requested || requested === actorCompanyId) {
      return actorCompanyId;
    }

    const observerCompanyId = resolveObserverScopeCompanyId({
      actorCompanyId,
      actorRole,
      requestedCompanyId: requested,
    });
    if (observerCompanyId !== actorCompanyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: observerCompanyId },
        select: { type: true },
      });
      if (!company) {
        throw new NotFoundException('Company not found');
      }
      if (company.type !== CompanyType.CLIENT) {
        throw new BadRequestException(
          'Observer scope must be a CLIENT company',
        );
      }
      return observerCompanyId;
    }

    const linkedAccess =
      await this.serviceContractsService.getLinkedClientAccess(
        actorCompanyId,
        requested,
      );
    if (!linkedAccess) {
      throw new NotFoundException('Linked client not found');
    }
    const linkedCompany = await this.prisma.company.findUnique({
      where: { id: requested },
      select: { type: true },
    });
    if (!linkedCompany || linkedCompany.type !== CompanyType.CLIENT) {
      throw new BadRequestException(
        'Linked client scope must be a CLIENT company',
      );
    }
    return requested;
  }

  async update(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    id: string,
    dto: UpdateEquipmentDto,
  ) {
    await this.assertWritableEquipment(actorCompanyId, actorUserId, actorRole, id);

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('name cannot be empty');
    }

    const nextType =
      dto.type !== undefined ? dto.type.trim().toUpperCase() : undefined;
    if (nextType !== undefined && !nextType) {
      throw new BadRequestException('type cannot be empty');
    }

    const nextStatus =
      dto.status !== undefined ? dto.status.trim().toUpperCase() : undefined;
    if (nextStatus !== undefined && !nextStatus) {
      throw new BadRequestException('status cannot be empty');
    }
    // Раньше принималось любое слово. Теперь набор закрыт, иначе фильтр по
    // статусу показывает мусор, а карточка — незнакомое состояние.
    if (
      nextStatus !== undefined &&
      !(EQUIPMENT_STATUSES as readonly string[]).includes(nextStatus)
    ) {
      throw new BadRequestException('Недопустимый статус оборудования');
    }

    // Обложкой может быть только снимок этой же единицы: чужой id — не «не найдено»,
    // а попытка сослаться на вложение другого владельца.
    let nextMainPhotoId: string | null | undefined;
    if (dto.mainPhotoId !== undefined) {
      const requested = (dto.mainPhotoId || '').trim();
      if (!requested) {
        nextMainPhotoId = null;
      } else {
        const attachment = await this.prisma.equipmentAttachment.findFirst({
          where: { id: requested, equipmentId: id },
          select: { id: true },
        });
        if (!attachment) {
          throw new NotFoundException('Attachment not found');
        }
        nextMainPhotoId = attachment.id;
      }
    }

    const manufacturer = optionalText(dto.manufacturer, 200);
    const model = optionalText(dto.model, 200);
    const serialNumber = optionalText(dto.serialNumber, 200);
    const inventoryNumber = optionalText(dto.inventoryNumber, 200);
    const commissionedAt = optionalDate(dto.commissionedAt);
    const warrantyUntil = optionalDate(dto.warrantyUntil);
    const description = optionalText(dto.description);

    return this.repo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(nextType !== undefined ? { type: nextType } : {}),
      ...(nextStatus !== undefined ? { status: nextStatus } : {}),
      ...(manufacturer !== undefined ? { manufacturer } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(serialNumber !== undefined ? { serialNumber } : {}),
      ...(inventoryNumber !== undefined ? { inventoryNumber } : {}),
      ...(commissionedAt !== undefined ? { commissionedAt } : {}),
      ...(warrantyUntil !== undefined ? { warrantyUntil } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(nextMainPhotoId !== undefined ? { mainPhotoId: nextMainPhotoId } : {}),
    });
  }

  async remove(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    id: string,
  ) {
    await this.assertWritableEquipment(actorCompanyId, actorUserId, actorRole, id);

    return this.repo.update(id, {
      status: 'INACTIVE',
    });
  }

  /**
   * SMA-EQUIPMENT-HISTORY-PARTS-110B: стал публичным — через него заводятся
   * позиции каталога комплектующих в контуре клиента.
   */
  async assertWritableLocation(params: {
    actorCompanyId: string;
    actorUserId: string;
    actorRole: UserRole;
    locationId: string;
  }) {
    const location = await this.repo.findLocationById(params.locationId);
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const owner = await this.prisma.company.findUnique({
      where: { id: location.clientCompanyId },
      select: { type: true },
    });
    if (!owner || owner.type !== CompanyType.CLIENT) {
      throw new NotFoundException('Location not found');
    }

    if (params.actorCompanyId === location.clientCompanyId) {
      return location;
    }

    const actorCompany = await this.prisma.company.findUnique({
      where: { id: params.actorCompanyId },
      select: { type: true },
    });
    if (!actorCompany || actorCompany.type !== CompanyType.PROVIDER) {
      throw new NotFoundException('Location not found');
    }

    const access =
      await this.serviceContractsService.assertPrimaryLinkedClientAccess(
        params.actorCompanyId,
        location.clientCompanyId,
      );
    if (!isServiceContractLocationAllowed(access, location.id)) {
      throw new NotFoundException('Location not found');
    }

    const actorLocationScope = await resolveActorLocationScope({
      prisma: this.prisma,
      actor: {
        id: params.actorUserId,
        role: params.actorRole,
        companyId: params.actorCompanyId,
      },
      scopeCompanyId: location.clientCompanyId,
    });
    if (!isLocationAllowedByLocationScope(actorLocationScope, location.id)) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }
}
