/**
 * SMA-UPDATES-CENTER-V1 — сервис на памяти.
 *
 * Фейковый prisma исполняет where так же, как БД (AND/OR, isEmpty/has, null),
 * поэтому tenant isolation и видимость по ролям проверяются поведением, а не
 * сравнением объектов запроса.
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProductUpdateStatus, UserRole } from '@prisma/client';

import { ProductUpdatesService } from './product-updates.service';

type Row = Record<string, any>;

function matches(row: Row, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === 'AND') return (cond as any[]).every((w) => matches(row, w));
    if (key === 'OR') return (cond as any[]).some((w) => matches(row, w));
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('isEmpty' in cond)
        return ((row[key] ?? []).length === 0) === cond.isEmpty;
      if ('has' in cond) return (row[key] ?? []).includes(cond.has);
    }
    return (row[key] ?? null) === cond;
  });
}

function fakePrisma() {
  const rows: Row[] = [];
  let seq = 0;
  const productUpdate = {
    rows,
    findMany: jest.fn(async ({ where }: any) =>
      rows.filter((r) => matches(r, where)),
    ),
    findFirst: jest.fn(
      async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null,
    ),
    create: jest.fn(async ({ data }: any) => {
      const row = {
        id: `u${++seq}`,
        media: [],
        audienceRoles: [],
        status: 'DRAFT',
        publishedAt: null,
        publishedById: null,
        ...data,
      };
      rows.push(row);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      return { count: hit.length };
    }),
    deleteMany: jest.fn(async ({ where }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) rows.splice(rows.indexOf(r), 1);
      return { count: hit.length };
    }),
  };
  return { productUpdate };
}

const platform = {
  id: 'p1',
  role: UserRole.PLATFORM_ADMIN,
  companyId: 'platform-co',
};
const adminA = { id: 'a1', role: UserRole.ADMIN, companyId: 'co-a' };
const adminB = { id: 'b1', role: UserRole.ADMIN, companyId: 'co-b' };
const techA = { id: 't1', role: UserRole.TECHNICIAN, companyId: 'co-a' };
const clientB = { id: 'c1', role: UserRole.CLIENT, companyId: 'co-b' };
const dispatcherA = { id: 'd1', role: UserRole.DISPATCHER, companyId: 'co-a' };

const full = {
  title: 'Новые обходы',
  summary: 'Кратко',
  changes: 'Что изменилось',
  howToUse: 'Как пользоваться',
};

function setup() {
  const prisma = fakePrisma();
  const svc = new ProductUpdatesService(prisma as any);
  return { prisma, svc };
}

async function published(
  svc: ProductUpdatesService,
  actor: any,
  extra: any = {},
) {
  const draft = await svc.create(actor, { ...full, ...extra });
  return svc.publish(actor, draft.id, { confirm: true });
}

describe('ProductUpdatesService — область карточек', () => {
  it('PLATFORM_ADMIN создаёт глобальную карточку, ADMIN — карточку своей компании', async () => {
    const { svc } = setup();
    expect((await svc.create(platform, full)).companyId).toBeNull();
    expect((await svc.create(adminA, full)).companyId).toBe('co-a');
  });

  it('новая карточка — всегда черновик, даже без полей', async () => {
    const { svc } = setup();
    const draft = await svc.create(adminA, {});
    expect(draft.status).toBe(ProductUpdateStatus.DRAFT);
    expect(draft.createdById).toBe('a1');
  });

  it('ведение запрещено не-администраторам', async () => {
    const { svc } = setup();
    await expect(svc.create(dispatcherA, full)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.listManaged(techA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('ProductUpdatesService — tenant isolation', () => {
  it('ADMIN другой компании не видит, не правит, не публикует и не удаляет чужую карточку', async () => {
    const { svc } = setup();
    const draft = await svc.create(adminA, full);
    expect(await svc.listManaged(adminB)).toEqual([]);
    await expect(
      svc.update(adminB, draft.id, { title: 'взлом' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      svc.publish(adminB, draft.id, { confirm: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.removeDraft(adminB, draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('ADMIN компании не ведёт глобальные карточки, PLATFORM_ADMIN — карточки компаний', async () => {
    const { svc } = setup();
    const global = await svc.create(platform, full);
    const local = await svc.create(adminA, full);
    await expect(
      svc.update(adminA, global.id, { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      svc.publish(platform, local.id, { confirm: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('опубликованная карточка компании видна только своей компании', async () => {
    const { svc } = setup();
    const local = await published(svc, adminA);
    expect((await svc.listPublished(techA)).map((u) => u.id)).toEqual([
      local.id,
    ]);
    expect(await svc.listPublished(clientB)).toEqual([]);
    await expect(svc.getPublished(clientB, local.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('глобальная опубликованная карточка видна всем компаниям', async () => {
    const { svc } = setup();
    const global = await published(svc, platform);
    expect((await svc.listPublished(techA)).map((u) => u.id)).toEqual([
      global.id,
    ]);
    expect((await svc.listPublished(clientB)).map((u) => u.id)).toEqual([
      global.id,
    ]);
  });
});

describe('ProductUpdatesService — видимость по ролям и статусу', () => {
  it('черновик читателям не виден', async () => {
    const { svc } = setup();
    const draft = await svc.create(platform, full);
    expect(await svc.listPublished(techA)).toEqual([]);
    await expect(svc.getPublished(techA, draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('карточка для техников не видна клиенту и диспетчеру', async () => {
    const { svc } = setup();
    const forTech = await published(svc, platform, {
      audienceRoles: [UserRole.TECHNICIAN],
    });
    expect((await svc.listPublished(techA)).map((u) => u.id)).toEqual([
      forTech.id,
    ]);
    expect(await svc.listPublished(clientB)).toEqual([]);
    expect(await svc.listPublished(dispatcherA)).toEqual([]);
  });
});

describe('ProductUpdatesService — публикация', () => {
  it('без явного подтверждения публикации нет', async () => {
    const { svc, prisma } = setup();
    const draft = await svc.create(adminA, full);
    await expect(
      svc.publish(adminA, draft.id, { confirm: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.publish(adminA, draft.id, {} as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productUpdate.rows[0].status).toBe(ProductUpdateStatus.DRAFT);
  });

  it('с подтверждением — опубликовано, кем и когда', async () => {
    const { svc } = setup();
    const result = await published(svc, adminA);
    expect(result.status).toBe(ProductUpdateStatus.PUBLISHED);
    expect(result.publishedById).toBe('a1');
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it('пустые разделы опубликовать нельзя', async () => {
    const { svc } = setup();
    const draft = await svc.create(adminA, { title: 'Только заголовок' });
    await expect(
      svc.publish(adminA, draft.id, { confirm: true }),
    ).rejects.toMatchObject({
      response: {
        code: 'PRODUCT_UPDATE_INCOMPLETE',
        missing: ['summary', 'changes', 'howToUse'],
      },
    });
  });

  it('опубликованное не правится и не удаляется; снятие с публикации возвращает черновик', async () => {
    const { svc } = setup();
    const live = await published(svc, adminA);
    await expect(
      svc.update(adminA, live.id, { title: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.removeDraft(adminA, live.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      svc.publish(adminA, live.id, { confirm: true }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const back = await svc.unpublish(adminA, live.id);
    expect(back.status).toBe(ProductUpdateStatus.DRAFT);
    expect(back.publishedAt).toBeNull();
    expect(await svc.listPublished(techA)).toEqual([]);
  });

  it('ссылка на внешний сайт и опасная картинка отвергаются с кодом', async () => {
    const { svc } = setup();
    await expect(
      svc.create(adminA, { ...full, featurePath: 'https://evil.example' }),
    ).rejects.toMatchObject({
      response: { code: 'FEATURE_PATH_INVALID' },
    });
    await expect(
      svc.create(adminA, { ...full, media: [{ url: 'javascript:alert(1)' }] }),
    ).rejects.toMatchObject({
      response: { code: 'MEDIA_URL_INVALID' },
    });
  });
});

describe('ProductUpdatesService — черновик из Production-релиза', () => {
  it('создаёт глобальный черновик, повтор по тому же SHA не плодит карточки', async () => {
    const { svc, prisma } = setup();
    const input = {
      releaseCommitSha: 'b479dc58',
      title: 'Релиз',
      summary: 's',
      changes: 'c',
    };
    const first = await svc.createDraftFromRelease(input, 'system');
    const second = await svc.createDraftFromRelease(
      { ...input, releaseCommitSha: 'B479DC58' },
      'system',
    );
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(prisma.productUpdate.rows).toHaveLength(1);
    expect(first.update).toMatchObject({
      companyId: null,
      status: ProductUpdateStatus.DRAFT,
      source: 'RELEASE',
    });
  });

  it('черновик релиза читателям не виден до публикации администратором', async () => {
    const { svc } = setup();
    const { update } = await svc.createDraftFromRelease(
      {
        releaseCommitSha: 'abcdef1',
        title: 'Релиз',
        summary: 's',
        changes: 'c',
        howToUse: 'h',
      },
      'system',
    );
    expect(await svc.listPublished(techA)).toEqual([]);
    await svc.publish(platform, update.id, { confirm: true });
    expect((await svc.listPublished(techA)).map((u) => u.id)).toEqual([
      update.id,
    ]);
  });
});
