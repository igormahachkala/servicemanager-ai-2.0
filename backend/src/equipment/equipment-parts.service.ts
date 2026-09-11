import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { EquipmentService } from './equipment.service';

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * Комплектующие единицы оборудования.
 *
 * Два правила задают всю модель.
 *
 * 1. История не переписывается. Замена не правит строку, а закрывает старую
 *    (removedAt + removedTicketId) и заводит новую. Поэтому «что стояло
 *    в прошлом году» остаётся видимым, а не исчезает при первом же ремонте.
 *
 * 2. Доступ не переизобретается. Чтение идёт через EquipmentService.findOne,
 *    запись — через EquipmentService.assertWritableEquipment. Оба —
 *    канонические пути модуля оборудования, и SECONDARY-провайдер не проходит
 *    во второй, потому что внутри assertPrimaryLinkedClientAccess.
 *
 * Складского здесь нет: ни остатков, ни цен, ни резервов, ни списаний.
 */

/** Наружу отдаётся вычисленным: отдельной колонки status нет намеренно. */
export type InstalledPartStatus = 'INSTALLED' | 'REMOVED';

const PART_SELECT = {
  id: true,
  companyId: true,
  equipmentId: true,
  partDefinitionId: true,
  displayName: true,
  serialNumber: true,
  quantity: true,
  installedAt: true,
  removedAt: true,
  installedTicketId: true,
  removedTicketId: true,
  comment: true,
  removalComment: true,
  partDefinition: {
    select: { id: true, name: true, manufacturer: true, model: true, article: true, unit: true },
  },
  installedTicket: { select: { id: true, ticketNumber: true, status: true } },
  removedTicket: { select: { id: true, ticketNumber: true, status: true } },
  installedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  removedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.InstalledPartSelect;

function optionalText(value: string | undefined, max = 2000): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function requiredText(value: string | undefined, field: string, max = 300): string {
  const trimmed = (value || '').trim();
  if (!trimmed) throw new BadRequestException(`${field} обязательно`);
  return trimmed.slice(0, max);
}

/**
 * Количество. Дробное допустимо — единицей измерения бывает метр или литр.
 * Ноль и отрицательные отклоняются: строка «поставили 0 штук» смысла не несёт.
 */
function parseQuantity(value: unknown): Prisma.Decimal {
  if (value === undefined || value === null || value === '') return new Prisma.Decimal(1);
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new BadRequestException('Количество должно быть положительным числом');
  }
  return new Prisma.Decimal(num.toFixed(3));
}

export type PartView = ReturnType<typeof toPartView>;

export function toPartView(row: any) {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    partDefinitionId: row.partDefinitionId,
    partDefinition: row.partDefinition ?? null,
    displayName: row.displayName,
    serialNumber: row.serialNumber,
    quantity: String(row.quantity),
    unit: row.partDefinition?.unit ?? null,
    // Единственный источник состояния — removedAt. Хранимой колонки нет,
    // поэтому разойтись с датой оно не может.
    status: (row.removedAt ? 'REMOVED' : 'INSTALLED') as InstalledPartStatus,
    installedAt: row.installedAt,
    removedAt: row.removedAt,
    installedTicket: row.installedTicket ?? null,
    removedTicket: row.removedTicket ?? null,
    installedBy: row.installedBy ?? null,
    removedBy: row.removedBy ?? null,
    comment: row.comment,
    removalComment: row.removalComment,
  };
}

@Injectable()
export class EquipmentPartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly equipmentService: EquipmentService,
  ) {}

  // ── справочник ──────────────────────────────────────────────────────────

  async listDefinitions(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    params: { companyId?: string; search?: string; includeInactive?: boolean } = {},
  ) {
    const companyId = await this.equipmentService.resolveReadableCompanyId(
      actorCompanyId,
      actorRole,
      params.companyId,
    );
    const search = (params.search || '').trim();
    return this.prisma.partDefinition.findMany({
      where: {
        companyId,
        // По умолчанию только действующие: выбирать для установки можно
        // лишь их. Выведенные из обращения нужны экрану управления каталогом
        // и истории — за ними приходят с includeInactive.
        ...(params.includeInactive ? {} : { isActive: true }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { manufacturer: { contains: search, mode: 'insensitive' as const } },
                { model: { contains: search, mode: 'insensitive' as const } },
                { article: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      take: 200,
    });
  }

  /**
   * Позиция каталога принадлежит клиентскому контуру, а не провайдеру.
   * Право на заведение проверяется по площадке клиента тем же шлюзом, что
   * и запись в оборудование: отдельного правила для каталога не вводится.
   */
  async createDefinition(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    dto: {
      locationId: string;
      name: string;
      manufacturer?: string;
      model?: string;
      article?: string;
      unit?: string;
    },
  ) {
    const location = await this.equipmentService.assertWritableLocation({
      actorCompanyId,
      actorUserId,
      actorRole,
      locationId: dto.locationId,
    });

    return this.prisma.partDefinition.create({
      data: {
        companyId: location.clientCompanyId,
        name: requiredText(dto.name, 'Название'),
        manufacturer: optionalText(dto.manufacturer, 200) ?? null,
        model: optionalText(dto.model, 200) ?? null,
        article: optionalText(dto.article, 200) ?? null,
        unit: (dto.unit || '').trim().slice(0, 20) || 'шт',
      },
    });
  }

  // ── установленные детали ────────────────────────────────────────────────

  async listForEquipment(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    equipmentId: string,
    requestedCompanyId?: string,
  ) {
    const equipment = await this.equipmentService.findOne(
      actorCompanyId,
      actorUserId,
      actorRole,
      equipmentId,
      requestedCompanyId,
    );

    const rows = await this.prisma.installedPart.findMany({
      where: { equipmentId, companyId: equipment.companyId },
      select: PART_SELECT,
      orderBy: [{ installedAt: 'desc' }],
    });

    const all = rows.map(toPartView);
    return {
      // Разделено на сервере: «стоит сейчас» — это removedAt IS NULL,
      // и решать это в браузере значило бы дублировать правило.
      installed: all.filter((row) => row.status === 'INSTALLED'),
      history: all.filter((row) => row.status === 'REMOVED'),
    };
  }

  async install(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    equipmentId: string,
    dto: {
      partDefinitionId?: string;
      displayName?: string;
      serialNumber?: string;
      quantity?: unknown;
      installedAt?: string;
      ticketId?: string;
      comment?: string;
    },
  ) {
    const equipment = await this.equipmentService.assertWritableEquipment(
      actorCompanyId,
      actorUserId,
      actorRole,
      equipmentId,
    );

    const data = await this.buildInstallData(equipment, actorUserId, dto, {
      ticketRequired: false,
    });
    const created = await this.prisma.installedPart.create({
      data,
      select: PART_SELECT,
    });
    return toPartView(created);
  }

  /**
   * Замена. Снятие старой и установка новой идут одной транзакцией: половина
   * замены в истории хуже, чем её отсутствие — по такой карточке нельзя понять,
   * что стоит сейчас.
   */
  async replace(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    equipmentId: string,
    partId: string,
    dto: {
      partDefinitionId?: string;
      displayName?: string;
      serialNumber?: string;
      quantity?: unknown;
      ticketId?: string;
      comment?: string;
      removalComment?: string;
      replacedAt?: string;
    },
  ) {
    const equipment = await this.equipmentService.assertWritableEquipment(
      actorCompanyId,
      actorUserId,
      actorRole,
      equipmentId,
    );

    const existing = await this.prisma.installedPart.findFirst({
      where: { id: partId, equipmentId, companyId: equipment.companyId },
      select: { id: true, removedAt: true, displayName: true, partDefinitionId: true },
    });
    if (!existing) {
      throw new NotFoundException('Installed part not found');
    }
    if (existing.removedAt) {
      throw new BadRequestException('Эта комплектующая уже снята');
    }

    // Для замены заявка обязательна: это сервисная работа, и она должна быть
    // прослеживаемой. Придумывать заявку под административную операцию нельзя,
    // поэтому первичная установка (install) заявки не требует.
    const ticketId = (dto.ticketId || '').trim();
    if (!ticketId) {
      throw new BadRequestException('Для замены нужно указать заявку');
    }

    const at = this.parseMoment(dto.replacedAt);
    const installData = await this.buildInstallData(
      equipment,
      actorUserId,
      { ...dto, installedAt: dto.replacedAt, ticketId },
      { ticketRequired: true, fallbackName: existing.displayName },
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.installedPart.update({
        where: { id: existing.id },
        data: {
          removedAt: at,
          removedTicketId: ticketId,
          removedByUserId: actorUserId,
          removalComment: optionalText(dto.removalComment) ?? null,
        },
      });

      const created = await tx.installedPart.create({
        data: installData,
        select: PART_SELECT,
      });

      const removed = await tx.installedPart.findUnique({
        where: { id: existing.id },
        select: PART_SELECT,
      });

      return { removed: toPartView(removed), installed: toPartView(created) };
    });
  }

  /**
   * SMA-EQUIPMENT-PARTS-POLISH-110C.
   *
   * Снятие без замены. Деталь вышла из строя, новая приедет завтра —
   * до 110C такое состояние выразить было нечем: замена требовала сразу
   * поставить что-то взамен.
   *
   * Новой строки не создаётся. Старая остаётся в истории навсегда, а из
   * «установлено сейчас» уходит, потому что список определяется removedAt.
   *
   * Заявка необязательна: снять деталь могут и административно, при выводе
   * оборудования из эксплуатации. Придумывать под это заявку нельзя — то же
   * правило, что и у первичной комплектации.
   */
  async removePart(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    equipmentId: string,
    partId: string,
    dto: { ticketId?: string; removedAt?: string; removalComment?: string },
  ) {
    const equipment = await this.equipmentService.assertWritableEquipment(
      actorCompanyId,
      actorUserId,
      actorRole,
      equipmentId,
    );

    const existing = await this.findOwnPart(equipment, partId);
    if (existing.removedAt) {
      throw new BadRequestException('Эта комплектующая уже снята');
    }

    const ticketId = (dto.ticketId || '').trim();
    if (ticketId) {
      await this.assertTicketBelongsToEquipment(equipment, ticketId);
    }

    const updated = await this.prisma.installedPart.update({
      where: { id: existing.id },
      data: {
        removedAt: this.parseMoment(dto.removedAt),
        removedTicketId: ticketId || null,
        removedByUserId: actorUserId,
        removalComment: optionalText(dto.removalComment) ?? null,
      },
      select: PART_SELECT,
    });
    return toPartView(updated);
  }

  /**
   * SMA-EQUIPMENT-PARTS-POLISH-110C.
   *
   * Правка административных полей: опечатка в серийном номере, неверное
   * количество, комментарий, привязка к каталогу.
   *
   * Историю правка не трогает намеренно. installedAt, removedAt, обе заявки
   * и оба исполнителя здесь недоступны: это следы произошедшего, и тихо
   * переписать их значит потерять то, ради чего история и ведётся. DTO их
   * не принимает; порядок исправления таких полей описан в отчёте задачи,
   * отдельной аудируемой операцией.
   *
   * Сама правка пишется в DomainEvent — канонический журнал системы. Новой
   * таблицы аудита не заводится.
   */
  async correctPart(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    equipmentId: string,
    partId: string,
    dto: {
      serialNumber?: string;
      quantity?: unknown;
      comment?: string;
      removalComment?: string;
      partDefinitionId?: string | null;
    },
  ) {
    const equipment = await this.equipmentService.assertWritableEquipment(
      actorCompanyId,
      actorUserId,
      actorRole,
      equipmentId,
    );
    const existing = await this.findOwnPart(equipment, partId);

    const data: Prisma.InstalledPartUncheckedUpdateInput = {};
    if (dto.serialNumber !== undefined) data.serialNumber = optionalText(dto.serialNumber, 200) ?? null;
    if (dto.comment !== undefined) data.comment = optionalText(dto.comment) ?? null;
    if (dto.removalComment !== undefined) data.removalComment = optionalText(dto.removalComment) ?? null;
    if (dto.quantity !== undefined) data.quantity = parseQuantity(dto.quantity);

    if (dto.partDefinitionId !== undefined) {
      const requested = (dto.partDefinitionId || '').trim();
      if (!requested) {
        data.partDefinitionId = null;
      } else {
        const row = await this.prisma.partDefinition.findFirst({
          where: { id: requested, companyId: equipment.companyId },
          select: { id: true, isActive: true },
        });
        if (!row) throw new NotFoundException('Part definition not found');
        if (!row.isActive) {
          throw new BadRequestException('Позиция каталога выведена из обращения');
        }
        data.partDefinitionId = row.id;
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Не передано ни одного поля для исправления');
    }

    const updated = await this.prisma.installedPart.update({
      where: { id: existing.id },
      data,
      select: PART_SELECT,
    });

    await this.prisma.domainEvent.create({
      data: {
        companyId: equipment.companyId,
        entityType: 'InstalledPart',
        entityId: existing.id,
        type: 'equipment.part_corrected',
        actorUserId: actorUserId,
        payload: {
          equipmentId: equipment.id,
          fields: Object.keys(data),
          before: {
            serialNumber: existing.serialNumber,
            quantity: String(existing.quantity),
            comment: existing.comment,
            removalComment: existing.removalComment,
            partDefinitionId: existing.partDefinitionId,
          },
        },
      },
    });

    return toPartView(updated);
  }

  /**
   * SMA-EQUIPMENT-PARTS-POLISH-110C.
   * Правка позиции каталога и вывод её из обращения. Жёсткого удаления нет:
   * на позицию ссылаются исторические строки, и удаление обрубило бы им связь.
   */
  async updateDefinition(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    definitionId: string,
    dto: {
      name?: string;
      manufacturer?: string;
      model?: string;
      article?: string;
      unit?: string;
      isActive?: boolean;
    },
  ) {
    const scopeCompanyId = await this.equipmentService.resolveReadableCompanyId(
      actorCompanyId,
      actorRole,
      undefined,
    );
    const existing = await this.prisma.partDefinition.findFirst({
      where: { id: definitionId },
      select: { id: true, companyId: true },
    });
    if (!existing) throw new NotFoundException('Part definition not found');

    // Право на правку каталога — то же, что и на запись в оборудование
    // клиента: проверяется по любой его площадке, отдельного правила нет.
    await this.assertCanManageCatalogue(actorCompanyId, actorUserId, actorRole, existing.companyId, scopeCompanyId);

    const data: Prisma.PartDefinitionUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = requiredText(dto.name, 'Название');
    if (dto.manufacturer !== undefined) data.manufacturer = optionalText(dto.manufacturer, 200) ?? null;
    if (dto.model !== undefined) data.model = optionalText(dto.model, 200) ?? null;
    if (dto.article !== undefined) data.article = optionalText(dto.article, 200) ?? null;
    if (dto.unit !== undefined) data.unit = (dto.unit || '').trim().slice(0, 20) || 'шт';
    if (dto.isActive !== undefined) data.isActive = Boolean(dto.isActive);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Не передано ни одного поля');
    }

    return this.prisma.partDefinition.update({ where: { id: existing.id }, data });
  }

  /**
   * Каталог принадлежит клиентской компании. Право на управление им сводится
   * к праву записи в оборудование этого клиента: своя матрица не заводится.
   */
  private async assertCanManageCatalogue(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    ownerCompanyId: string,
    scopeCompanyId: string,
  ) {
    if (actorCompanyId === ownerCompanyId) return;

    const location = await this.prisma.location.findFirst({
      where: { clientCompanyId: ownerCompanyId, isActive: true },
      select: { id: true },
    });
    if (!location) {
      throw new NotFoundException('Part definition not found');
    }
    await this.equipmentService.assertWritableLocation({
      actorCompanyId,
      actorUserId,
      actorRole,
      locationId: location.id,
    });
  }

  private async findOwnPart(equipment: { id: string; companyId: string }, partId: string) {
    const row = await this.prisma.installedPart.findFirst({
      where: { id: partId, equipmentId: equipment.id, companyId: equipment.companyId },
      select: {
        id: true, removedAt: true, displayName: true, partDefinitionId: true,
        serialNumber: true, quantity: true, comment: true, removalComment: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Installed part not found');
    }
    return row;
  }

  private async assertTicketBelongsToEquipment(
    equipment: { id: string; companyId: string },
    ticketId: string,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId: equipment.companyId, equipmentId: equipment.id },
      select: { id: true },
    });
    if (!ticket) {
      throw new BadRequestException('Заявка не относится к этой единице оборудования');
    }
  }

  // ── внутреннее ──────────────────────────────────────────────────────────

  private parseMoment(value?: string): Date {
    const trimmed = (value || '').trim();
    if (!trimmed) return new Date();
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Некорректная дата');
    }
    return parsed;
  }

  private async buildInstallData(
    equipment: { id: string; companyId: string },
    actorUserId: string,
    dto: {
      partDefinitionId?: string;
      displayName?: string;
      serialNumber?: string;
      quantity?: unknown;
      installedAt?: string;
      ticketId?: string;
      comment?: string;
    },
    options: { ticketRequired: boolean; fallbackName?: string },
  ): Promise<Prisma.InstalledPartUncheckedCreateInput> {
    let definition: { id: string; name: string } | null = null;
    const definitionId = (dto.partDefinitionId || '').trim();
    if (definitionId) {
      const row = await this.prisma.partDefinition.findFirst({
        // Каталог чужого контура недоступен: позиция обязана принадлежать
        // той же клиентской компании, что и оборудование.
        where: { id: definitionId, companyId: equipment.companyId },
        select: { id: true, name: true, isActive: true },
      });
      if (!row) {
        throw new NotFoundException('Part definition not found');
      }
      // SMA-EQUIPMENT-PARTS-POLISH-110C: выведенную из обращения позицию
      // нельзя поставить заново. В истории она остаётся — там ссылка уже есть,
      // и запрет на выбор её не трогает.
      if (!row.isActive) {
        throw new BadRequestException('Позиция каталога выведена из обращения и недоступна для установки');
      }
      definition = { id: row.id, name: row.name };
    }

    // Имя хранится в строке всегда, даже когда есть справочник: переименование
    // позиции в каталоге не должно задним числом менять историю.
    const displayName = (dto.displayName || '').trim()
      ? requiredText(dto.displayName, 'Название')
      : definition?.name || options.fallbackName || requiredText(undefined, 'Название');

    const ticketId = (dto.ticketId || '').trim();
    if (options.ticketRequired && !ticketId) {
      throw new BadRequestException('Для замены нужно указать заявку');
    }
    if (ticketId) {
      const ticket = await this.prisma.ticket.findFirst({
        // Заявка обязана быть из того же контура и по этой же единице:
        // иначе история ссылалась бы на чужую работу.
        where: { id: ticketId, companyId: equipment.companyId, equipmentId: equipment.id },
        select: { id: true },
      });
      if (!ticket) {
        throw new BadRequestException('Заявка не относится к этой единице оборудования');
      }
    }

    return {
      companyId: equipment.companyId,
      equipmentId: equipment.id,
      partDefinitionId: definition?.id ?? null,
      displayName,
      serialNumber: optionalText(dto.serialNumber, 200) ?? null,
      quantity: parseQuantity(dto.quantity),
      installedAt: this.parseMoment(dto.installedAt),
      installedTicketId: ticketId || null,
      installedByUserId: actorUserId,
      comment: optionalText(dto.comment) ?? null,
    };
  }
}
