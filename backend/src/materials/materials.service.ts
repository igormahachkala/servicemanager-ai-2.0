import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MaterialHolderType,
  MaterialMovementType,
  Prisma,
  ServiceContractRole,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import {
  resolveReadableTicketAccess,
  resolveTicketOperationAccess,
} from '../tickets/ticket-access.utils';
import {
  ConsumeMaterialDto,
  CreateMaterialDto,
  IssueMaterialDto,
  MaterialQuantityDto,
  PurchaseMaterialDto,
  UpdateMaterialDto,
} from './dto/materials.dto';

type Actor = {
  id: string;
  companyId: string;
  role: UserRole;
  accessFlags?: Record<string, boolean>;
};

const MATERIAL_SELECT = {
  id: true,
  companyId: true,
  name: true,
  unit: true,
  sku: true,
  category: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MaterialSelect;

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  list(companyId: string) {
    return this.prisma.material.findMany({
      where: { companyId },
      select: MATERIAL_SELECT,
      orderBy: [{ active: 'desc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  async create(companyId: string, dto: CreateMaterialDto) {
    const name = this.requiredText(dto.name, 'Название материала обязательно');
    const unit = this.requiredText(dto.unit, 'Единица измерения обязательна');

    try {
      return await this.prisma.material.create({
        data: {
          companyId,
          name,
          unit,
          sku: this.optionalText(dto.sku),
          category: this.optionalText(dto.category),
        },
        select: MATERIAL_SELECT,
      });
    } catch (error) {
      this.rethrowMaterialConflict(error);
    }
  }

  async update(companyId: string, materialId: string, dto: UpdateMaterialDto) {
    await this.assertMaterial(this.prisma, companyId, materialId, false);

    const data: Prisma.MaterialUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = this.requiredText(dto.name, 'Название материала обязательно');
    }
    if (dto.unit !== undefined) {
      data.unit = this.requiredText(dto.unit, 'Единица измерения обязательна');
    }
    if (dto.sku !== undefined) data.sku = this.optionalText(dto.sku);
    if (dto.category !== undefined)
      data.category = this.optionalText(dto.category);
    if (dto.active !== undefined) data.active = dto.active;

    try {
      return await this.prisma.material.update({
        where: { id: materialId },
        data,
        select: MATERIAL_SELECT,
      });
    } catch (error) {
      this.rethrowMaterialConflict(error);
    }
  }

  getMyBalances(actor: Actor) {
    return this.getTechnicianBalances(actor.companyId, actor.id);
  }

  async getTechnicianBalances(companyId: string, technicianId: string) {
    await this.assertTechnician(this.prisma, companyId, technicianId);
    return this.prisma.materialBalance.findMany({
      where: {
        companyId,
        holderType: MaterialHolderType.TECHNICIAN,
        holderUserId: technicianId,
      },
      include: { material: { select: MATERIAL_SELECT } },
      orderBy: [{ material: { name: 'asc' } }, { materialId: 'asc' }],
    });
  }

  getMyMovements(actor: Actor) {
    return this.getTechnicianMovements(actor.companyId, actor.id);
  }

  async getTechnicianMovements(companyId: string, technicianId: string) {
    await this.assertTechnician(this.prisma, companyId, technicianId);
    return this.prisma.materialMovement.findMany({
      where: {
        companyId,
        OR: [{ fromUserId: technicianId }, { toUserId: technicianId }],
      },
      include: {
        material: { select: MATERIAL_SELECT },
        actor: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        fromUser: { select: { id: true, firstName: true, lastName: true } },
        toUser: { select: { id: true, firstName: true, lastName: true } },
        ticket: { select: { id: true, ticketNumber: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
  }

  receiptToCompanyStock(actor: Actor, dto: MaterialQuantityDto) {
    const quantity = this.positiveDecimal(dto.quantity);
    return this.serializable(async (tx) => {
      await this.assertMaterial(tx, actor.companyId, dto.materialId);
      const balance = await this.incrementCompanyStock(
        tx,
        actor.companyId,
        dto.materialId,
        quantity,
      );
      const movement = await tx.materialMovement.create({
        data: {
          companyId: actor.companyId,
          materialId: dto.materialId,
          type: MaterialMovementType.ADJUSTMENT_PLUS,
          quantity,
          toHolderType: MaterialHolderType.COMPANY_STOCK,
          actorUserId: actor.id,
          comment: this.optionalText(dto.comment),
        },
      });
      return { balance, movement };
    });
  }

  issue(actor: Actor, dto: IssueMaterialDto) {
    const quantity = this.positiveDecimal(dto.quantity);
    return this.serializable(async (tx) => {
      await this.assertMaterial(tx, actor.companyId, dto.materialId);
      await this.assertTechnician(tx, actor.companyId, dto.technicianId);
      const stock = await this.decrementBalance(tx, {
        companyId: actor.companyId,
        materialId: dto.materialId,
        holderType: MaterialHolderType.COMPANY_STOCK,
        holderUserId: null,
        quantity,
      });
      const technicianBalance = await this.incrementTechnicianBalance(
        tx,
        actor.companyId,
        dto.materialId,
        dto.technicianId,
        quantity,
      );
      const movement = await tx.materialMovement.create({
        data: {
          companyId: actor.companyId,
          materialId: dto.materialId,
          type: MaterialMovementType.ISSUE,
          quantity,
          fromHolderType: MaterialHolderType.COMPANY_STOCK,
          toHolderType: MaterialHolderType.TECHNICIAN,
          toUserId: dto.technicianId,
          actorUserId: actor.id,
          comment: this.optionalText(dto.comment),
        },
      });
      return { stock, technicianBalance, movement };
    });
  }

  purchase(actor: Actor, dto: PurchaseMaterialDto) {
    const quantity = this.positiveDecimal(dto.quantity);
    const unitPrice = this.optionalMoney(dto.unitPrice);
    const totalAmount =
      this.optionalMoney(dto.totalAmount) ??
      (unitPrice ? unitPrice.mul(quantity).toDecimalPlaces(2) : null);

    return this.serializable(async (tx) => {
      await this.assertTechnician(tx, actor.companyId, actor.id);
      await this.assertMaterial(tx, actor.companyId, dto.materialId);
      const balance = await this.incrementTechnicianBalance(
        tx,
        actor.companyId,
        dto.materialId,
        actor.id,
        quantity,
      );
      const movement = await tx.materialMovement.create({
        data: {
          companyId: actor.companyId,
          materialId: dto.materialId,
          type: MaterialMovementType.PURCHASE,
          quantity,
          toHolderType: MaterialHolderType.TECHNICIAN,
          toUserId: actor.id,
          actorUserId: actor.id,
          unitPrice,
          totalAmount,
          comment: this.optionalText(dto.comment),
        },
      });
      return { balance, movement };
    });
  }

  async consume(actor: Actor, dto: ConsumeMaterialDto) {
    const quantity = this.positiveDecimal(dto.quantity);
    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor,
      ticketId: dto.ticketId,
      linkedClientCompanyId: dto.linkedClientCompanyId,
      allowedLinkedClientContractRoles: [
        ServiceContractRole.PRIMARY,
        ServiceContractRole.SECONDARY,
      ],
    });

    return this.serializable(async (tx) => {
      await this.assertTechnician(tx, actor.companyId, actor.id);
      await this.assertMaterial(tx, actor.companyId, dto.materialId);
      const ticket = await tx.ticket.findFirst({
        where: { id: dto.ticketId, companyId: access.ticket.companyId },
        select: { id: true },
      });
      if (!ticket) throw new NotFoundException('Заявка не найдена');

      const balance = await this.decrementBalance(tx, {
        companyId: actor.companyId,
        materialId: dto.materialId,
        holderType: MaterialHolderType.TECHNICIAN,
        holderUserId: actor.id,
        quantity,
      });
      const movement = await tx.materialMovement.create({
        data: {
          companyId: actor.companyId,
          materialId: dto.materialId,
          type: MaterialMovementType.CONSUMPTION,
          quantity,
          fromHolderType: MaterialHolderType.TECHNICIAN,
          fromUserId: actor.id,
          ticketId: dto.ticketId,
          actorUserId: actor.id,
          comment: this.optionalText(dto.comment),
        },
      });
      return { balance, movement };
    });
  }

  async getTicketConsumptions(
    actor: Actor,
    ticketId: string,
    linkedClientCompanyId?: string,
  ) {
    const access = await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor,
      ticketId,
      linkedClientCompanyId,
      allowedLinkedClientContractRoles: [
        ServiceContractRole.PRIMARY,
        ServiceContractRole.SECONDARY,
      ],
    });

    return this.prisma.materialMovement.findMany({
      where: {
        ticketId,
        type: MaterialMovementType.CONSUMPTION,
        ...(access.ticket.companyId === actor.companyId
          ? {}
          : { companyId: actor.companyId }),
      },
      include: {
        material: { select: MATERIAL_SELECT },
        fromUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  private async assertMaterial(
    tx: Prisma.TransactionClient | PrismaService,
    companyId: string,
    materialId: string,
    activeOnly = true,
  ) {
    const material = await tx.material.findFirst({
      where: {
        id: materialId,
        companyId,
        ...(activeOnly ? { active: true } : {}),
      },
      select: { id: true },
    });
    if (!material) throw new NotFoundException('Материал не найден');
    return material;
  }

  private async assertTechnician(
    tx: Prisma.TransactionClient | PrismaService,
    companyId: string,
    technicianId: string,
  ) {
    const technician = await tx.user.findFirst({
      where: {
        id: technicianId,
        companyId,
        role: UserRole.TECHNICIAN,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!technician) throw new NotFoundException('Техник не найден');
    return technician;
  }

  private async incrementCompanyStock(
    tx: Prisma.TransactionClient,
    companyId: string,
    materialId: string,
    quantity: Prisma.Decimal,
  ) {
    const existing = await tx.materialBalance.findFirst({
      where: {
        companyId,
        materialId,
        holderType: MaterialHolderType.COMPANY_STOCK,
        holderUserId: null,
      },
      select: { id: true },
    });
    if (existing) {
      return tx.materialBalance.update({
        where: { id: existing.id },
        data: { quantity: { increment: quantity } },
      });
    }
    return tx.materialBalance.create({
      data: {
        companyId,
        materialId,
        holderType: MaterialHolderType.COMPANY_STOCK,
        holderUserId: null,
        quantity,
      },
    });
  }

  private incrementTechnicianBalance(
    tx: Prisma.TransactionClient,
    companyId: string,
    materialId: string,
    technicianId: string,
    quantity: Prisma.Decimal,
  ) {
    return tx.materialBalance.upsert({
      where: {
        companyId_materialId_holderType_holderUserId: {
          companyId,
          materialId,
          holderType: MaterialHolderType.TECHNICIAN,
          holderUserId: technicianId,
        },
      },
      create: {
        companyId,
        materialId,
        holderType: MaterialHolderType.TECHNICIAN,
        holderUserId: technicianId,
        quantity,
      },
      update: { quantity: { increment: quantity } },
    });
  }

  private async decrementBalance(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      materialId: string;
      holderType: MaterialHolderType;
      holderUserId: string | null;
      quantity: Prisma.Decimal;
    },
  ) {
    const updated = await tx.materialBalance.updateMany({
      where: {
        companyId: params.companyId,
        materialId: params.materialId,
        holderType: params.holderType,
        holderUserId: params.holderUserId,
        quantity: { gte: params.quantity },
      },
      data: { quantity: { decrement: params.quantity } },
    });
    if (updated.count !== 1) {
      throw new BadRequestException('Недостаточно материала на остатке');
    }
    return tx.materialBalance.findFirstOrThrow({
      where: {
        companyId: params.companyId,
        materialId: params.materialId,
        holderType: params.holderType,
        holderUserId: params.holderUserId,
      },
    });
  }

  private async serializable<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if ((code !== 'P2034' && code !== 'P2002') || attempt === 2)
          throw error;
      }
    }
    throw new ConflictException('Не удалось завершить операцию с остатком');
  }

  private positiveDecimal(value: string) {
    let decimal: Prisma.Decimal;
    try {
      decimal = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('Некорректное количество');
    }
    if (!decimal.isFinite() || decimal.lte(0)) {
      throw new BadRequestException('Количество должно быть больше нуля');
    }
    if (decimal.decimalPlaces() > 3) {
      throw new BadRequestException(
        'Количество поддерживает не более 3 знаков после запятой',
      );
    }
    return decimal;
  }

  private optionalMoney(value?: string) {
    if (value === undefined) return null;
    let decimal: Prisma.Decimal;
    try {
      decimal = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('Некорректная сумма');
    }
    if (!decimal.isFinite() || decimal.lt(0) || decimal.decimalPlaces() > 2) {
      throw new BadRequestException(
        'Сумма должна быть неотрицательной и иметь не более 2 знаков после запятой',
      );
    }
    return decimal;
  }

  private requiredText(value: string, message: string) {
    const normalized = value.trim();
    if (!normalized) throw new BadRequestException(message);
    return normalized;
  }

  private optionalText(value?: string | null) {
    if (value === undefined || value === null) return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private rethrowMaterialConflict(error: unknown): never {
    if ((error as { code?: string })?.code === 'P2002') {
      throw new ConflictException(
        'Материал с таким названием или SKU уже существует',
      );
    }
    throw error;
  }
}
