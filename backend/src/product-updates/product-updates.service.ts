import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductUpdateSource,
  ProductUpdateStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  PublishProductUpdateDto,
  UpsertProductUpdateDto,
} from './dto/product-update.dto';
import {
  buildReleaseDraft,
  canManageProductUpdates,
  managedCompanyIdFor,
  managedWhere,
  missingForPublish,
  normalizeAudienceRoles,
  normalizeFeaturePath,
  normalizeMedia,
  readableWhere,
  type ProductUpdateActor,
  type ReleaseDraftInput,
} from './product-updates.policy';

/** Ошибки чистого модуля → 400 с кодом. Всё остальное пробрасывается как есть. */
function asBadRequest<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof Error && /^[A-Z_]+$/.test(error.message)) {
      throw new BadRequestException({
        code: error.message,
        message: error.message,
      });
    }
    throw error;
  }
}

@Injectable()
export class ProductUpdatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Чтение («Что нового») ────────────────────────────────────────────────

  /** История опубликованных обновлений, новые сверху. */
  async listPublished(actor: ProductUpdateActor) {
    return this.prisma.productUpdate.findMany({
      where: readableWhere(actor),
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async getPublished(actor: ProductUpdateActor, id: string) {
    const update = await this.prisma.productUpdate.findFirst({
      where: { AND: [{ id }, readableWhere(actor)] },
    });
    // Черновик, чужая компания и чужая роль неотличимы от отсутствия карточки.
    if (!update) throw new NotFoundException('Обновление не найдено');
    return update;
  }

  // ─── Управление ───────────────────────────────────────────────────────────

  private assertManager(actor: ProductUpdateActor) {
    if (!canManageProductUpdates(actor)) {
      throw new ForbiddenException({
        code: 'PRODUCT_UPDATE_MANAGE_FORBIDDEN',
        message: 'Нет прав на ведение обновлений',
      });
    }
  }

  /** Карточки области администратора во всех статусах. */
  async listManaged(actor: ProductUpdateActor) {
    this.assertManager(actor);
    return this.prisma.productUpdate.findMany({
      where: managedWhere(actor),
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });
  }

  private async findManaged(actor: ProductUpdateActor, id: string) {
    this.assertManager(actor);
    const update = await this.prisma.productUpdate.findFirst({
      where: { AND: [{ id }, managedWhere(actor)] },
    });
    if (!update) throw new NotFoundException('Обновление не найдено');
    return update;
  }

  async create(actor: ProductUpdateActor, dto: UpsertProductUpdateDto) {
    this.assertManager(actor);
    const data = asBadRequest(() => ({
      featurePath: normalizeFeaturePath(dto.featurePath),
      media: normalizeMedia(dto.media),
      audienceRoles: normalizeAudienceRoles(dto.audienceRoles),
    }));
    return this.prisma.productUpdate.create({
      data: {
        companyId: managedCompanyIdFor(actor),
        status: ProductUpdateStatus.DRAFT,
        source: ProductUpdateSource.MANUAL,
        title: (dto.title ?? '').trim(),
        summary: (dto.summary ?? '').trim(),
        changes: (dto.changes ?? '').trim(),
        howToUse: (dto.howToUse ?? '').trim(),
        featurePath: data.featurePath,
        media: data.media as Prisma.InputJsonValue,
        audienceRoles: data.audienceRoles,
        createdById: actor.id,
      },
    });
  }

  /** Правится только черновик. Опубликованную карточку сначала снимают с публикации. */
  async update(
    actor: ProductUpdateActor,
    id: string,
    dto: UpsertProductUpdateDto,
  ) {
    const current = await this.findManaged(actor, id);
    if (current.status !== ProductUpdateStatus.DRAFT) {
      throw new BadRequestException({
        code: 'PRODUCT_UPDATE_NOT_DRAFT',
        message: 'Редактируется только черновик',
      });
    }

    const data: Prisma.ProductUpdateUpdateManyMutationInput = {
      updatedById: actor.id,
    };
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.summary !== undefined) data.summary = dto.summary.trim();
    if (dto.changes !== undefined) data.changes = dto.changes.trim();
    if (dto.howToUse !== undefined) data.howToUse = dto.howToUse.trim();
    asBadRequest(() => {
      if (dto.featurePath !== undefined)
        data.featurePath = normalizeFeaturePath(dto.featurePath);
      if (dto.media !== undefined)
        data.media = normalizeMedia(dto.media) as Prisma.InputJsonValue;
      if (dto.audienceRoles !== undefined)
        data.audienceRoles = normalizeAudienceRoles(dto.audienceRoles);
    });

    // Условие на статус в самом UPDATE: параллельная публикация не даст править уже опубликованное.
    const result = await this.prisma.productUpdate.updateMany({
      where: {
        AND: [{ id, status: ProductUpdateStatus.DRAFT }, managedWhere(actor)],
      },
      data,
    });
    if (result.count === 0) {
      throw new BadRequestException({
        code: 'PRODUCT_UPDATE_NOT_DRAFT',
        message: 'Редактируется только черновик',
      });
    }
    return this.findManaged(actor, id);
  }

  /**
   * Публикация — только уполномоченным администратором области и только с
   * явным подтверждением. Пустые разделы опубликовать нельзя.
   */
  async publish(
    actor: ProductUpdateActor,
    id: string,
    dto: PublishProductUpdateDto,
  ) {
    if (dto?.confirm !== true) {
      throw new BadRequestException({
        code: 'PRODUCT_UPDATE_CONFIRM_REQUIRED',
        message: 'Подтвердите публикацию',
      });
    }
    const current = await this.findManaged(actor, id);
    if (current.status !== ProductUpdateStatus.DRAFT) {
      throw new BadRequestException({
        code: 'PRODUCT_UPDATE_NOT_DRAFT',
        message: 'Опубликовать можно только черновик',
      });
    }
    const missing = missingForPublish(current);
    if (missing.length) {
      throw new BadRequestException({
        code: 'PRODUCT_UPDATE_INCOMPLETE',
        message: 'Заполните все разделы карточки',
        missing,
      });
    }

    const result = await this.prisma.productUpdate.updateMany({
      where: {
        AND: [{ id, status: ProductUpdateStatus.DRAFT }, managedWhere(actor)],
      },
      data: {
        status: ProductUpdateStatus.PUBLISHED,
        publishedById: actor.id,
        publishedAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new BadRequestException({
        code: 'PRODUCT_UPDATE_NOT_DRAFT',
        message: 'Опубликовать можно только черновик',
      });
    }
    return this.findManaged(actor, id);
  }

  /** Снять с публикации: карточка возвращается в черновик и исчезает у читателей. */
  async unpublish(actor: ProductUpdateActor, id: string) {
    const current = await this.findManaged(actor, id);
    if (current.status !== ProductUpdateStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'PRODUCT_UPDATE_NOT_PUBLISHED',
        message: 'Карточка не опубликована',
      });
    }
    await this.prisma.productUpdate.updateMany({
      where: {
        AND: [
          { id, status: ProductUpdateStatus.PUBLISHED },
          managedWhere(actor),
        ],
      },
      data: {
        status: ProductUpdateStatus.DRAFT,
        publishedById: null,
        publishedAt: null,
        updatedById: actor.id,
      },
    });
    return this.findManaged(actor, id);
  }

  /** Удаляется только черновик: опубликованную историю не стирают молча. */
  async removeDraft(actor: ProductUpdateActor, id: string) {
    await this.findManaged(actor, id);
    const result = await this.prisma.productUpdate.deleteMany({
      where: {
        AND: [{ id, status: ProductUpdateStatus.DRAFT }, managedWhere(actor)],
      },
    });
    if (result.count === 0) {
      throw new BadRequestException({
        code: 'PRODUCT_UPDATE_NOT_DRAFT',
        message: 'Удалить можно только черновик',
      });
    }
    return { ok: true };
  }

  // ─── Основа автосоздания после Production-релиза ──────────────────────────

  /**
   * Черновик карточки по Production-релизу.
   *
   * Эндпоинта и автоматического вызова на этом этапе нет — это точка входа
   * для будущего шага релиза. Повтор по тому же SHA возвращает существующую
   * карточку, а не создаёт вторую. Публикации здесь нет и быть не должно.
   */
  async createDraftFromRelease(
    input: ReleaseDraftInput,
    systemActorId: string,
  ) {
    const data = asBadRequest(() => buildReleaseDraft(input, systemActorId));
    const existing = await this.prisma.productUpdate.findFirst({
      where: { companyId: null, releaseCommitSha: data.releaseCommitSha },
    });
    if (existing) return { created: false, update: existing };
    const update = await this.prisma.productUpdate.create({
      data: {
        ...data,
        source: ProductUpdateSource.RELEASE,
        media: data.media as Prisma.InputJsonValue,
      },
    });
    return { created: true, update };
  }
}
