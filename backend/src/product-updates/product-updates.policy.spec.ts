/**
 * SMA-UPDATES-CENTER-V1 — правила Центра обновлений, проверки исполнением.
 */
import { ProductUpdateStatus, UserRole } from '@prisma/client';

import {
  buildReleaseDraft,
  canManageProductUpdates,
  managedCompanyIdFor,
  missingForPublish,
  normalizeAudienceRoles,
  normalizeFeaturePath,
  normalizeMedia,
  readableWhere,
} from './product-updates.policy';

const platform = {
  id: 'p1',
  role: UserRole.PLATFORM_ADMIN,
  companyId: 'platform-co',
};
const adminA = { id: 'a1', role: UserRole.ADMIN, companyId: 'co-a' };
const techA = { id: 't1', role: UserRole.TECHNICIAN, companyId: 'co-a' };

describe('кто ведёт карточки', () => {
  it('PLATFORM_ADMIN и ADMIN компании — да', () => {
    expect(canManageProductUpdates(platform)).toBe(true);
    expect(canManageProductUpdates(adminA)).toBe(true);
  });

  it('остальные роли и ADMIN без компании — нет', () => {
    for (const role of [
      UserRole.CLIENT_ADMIN,
      UserRole.DISPATCHER,
      UserRole.MASTER,
      UserRole.TECHNICIAN,
      UserRole.CLIENT,
      UserRole.NETWORK_DIRECTOR,
      UserRole.STAFF,
    ]) {
      expect(canManageProductUpdates({ role, companyId: 'co-a' })).toBe(false);
    }
    expect(
      canManageProductUpdates({ role: UserRole.ADMIN, companyId: null }),
    ).toBe(false);
  });

  it('PLATFORM_ADMIN ведёт только глобальные карточки, ADMIN — только своей компании', () => {
    expect(managedCompanyIdFor(platform)).toBeNull();
    expect(managedCompanyIdFor(adminA)).toBe('co-a');
    expect(() => managedCompanyIdFor(techA)).toThrow(
      'PRODUCT_UPDATE_MANAGE_FORBIDDEN',
    );
  });
});

describe('readableWhere — что видит читатель', () => {
  it('только опубликованные, глобальные и своей компании, адресованные его роли', () => {
    expect(readableWhere(techA)).toEqual({
      AND: [
        { status: ProductUpdateStatus.PUBLISHED },
        { OR: [{ companyId: null }, { companyId: 'co-a' }] },
        {
          OR: [
            { audienceRoles: { isEmpty: true } },
            { audienceRoles: { has: UserRole.TECHNICIAN } },
          ],
        },
      ],
    });
  });

  it('без компании — только глобальные', () => {
    const where = readableWhere({
      id: 'x',
      role: UserRole.CLIENT,
      companyId: null,
    }) as any;
    expect(where.AND[1]).toEqual({ OR: [{ companyId: null }] });
  });

  it('неизвестная роль видит только карточки «для всех»', () => {
    const where = readableWhere({
      id: 'x',
      role: 'GHOST',
      companyId: 'co-a',
    }) as any;
    expect(where.AND[2]).toEqual({
      OR: [{ audienceRoles: { isEmpty: true } }],
    });
  });
});

describe('проверка содержимого', () => {
  it('ссылка на функцию — только внутренний путь', () => {
    expect(normalizeFeaturePath(' /inspection/schedules ')).toBe(
      '/inspection/schedules',
    );
    expect(normalizeFeaturePath('')).toBeNull();
    expect(normalizeFeaturePath(null)).toBeNull();
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      'javascript:alert(1)',
      'inspection',
      '/a b',
      '/a\\b',
    ]) {
      expect(() => normalizeFeaturePath(bad)).toThrow('FEATURE_PATH_INVALID');
    }
  });

  it('изображения: https или путь приложения, с пояснением', () => {
    expect(
      normalizeMedia([
        { url: 'https://cdn.example/a.png', caption: ' Экран ' },
        { url: '/uploads/b.png' },
      ]),
    ).toEqual([
      { url: 'https://cdn.example/a.png', caption: 'Экран' },
      { url: '/uploads/b.png', caption: '' },
    ]);
    for (const url of [
      'http://cdn.example/a.png',
      'data:image/png;base64,AAA',
      'javascript:alert(1)',
      '//evil/a.png',
    ]) {
      expect(() => normalizeMedia([{ url }])).toThrow('MEDIA_URL_INVALID');
    }
    expect(() =>
      normalizeMedia(Array.from({ length: 11 }, () => ({ url: '/a.png' }))),
    ).toThrow('MEDIA_TOO_MANY');
    expect(() =>
      normalizeMedia([{ url: '/a.png', caption: 'x'.repeat(301) }]),
    ).toThrow('MEDIA_CAPTION_TOO_LONG');
  });

  it('аудитория: только существующие роли, без повторов', () => {
    expect(
      normalizeAudienceRoles(['TECHNICIAN', 'TECHNICIAN', 'CLIENT']),
    ).toEqual(['TECHNICIAN', 'CLIENT']);
    expect(normalizeAudienceRoles(undefined)).toEqual([]);
    expect(() => normalizeAudienceRoles(['ROOT'])).toThrow('AUDIENCE_INVALID');
  });

  it('без любого из четырёх разделов публиковать нельзя', () => {
    expect(
      missingForPublish({
        title: 'T',
        summary: 'S',
        changes: 'C',
        howToUse: 'H',
      }),
    ).toEqual([]);
    expect(
      missingForPublish({
        title: ' ',
        summary: 'S',
        changes: '',
        howToUse: null,
      }),
    ).toEqual(['title', 'changes', 'howToUse']);
  });
});

describe('buildReleaseDraft — основа автосоздания', () => {
  it('только глобальный черновик с SHA релиза, публикации нет', () => {
    const draft = buildReleaseDraft(
      {
        releaseCommitSha: 'B479DC58',
        title: ' Обходы ',
        summary: 's',
        changes: 'c',
        featurePath: '/inspection/runs',
      },
      'system',
    );
    expect(draft).toMatchObject({
      companyId: null,
      status: ProductUpdateStatus.DRAFT,
      source: 'RELEASE',
      releaseCommitSha: 'b479dc58',
      title: 'Обходы',
      howToUse: '',
      featurePath: '/inspection/runs',
      createdById: 'system',
    });
  });

  it('битый SHA отвергается', () => {
    expect(() =>
      buildReleaseDraft(
        { releaseCommitSha: 'main', title: 't', summary: 's', changes: 'c' },
        'system',
      ),
    ).toThrow('RELEASE_SHA_INVALID');
  });
});
