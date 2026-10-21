/**
 * SMA-UPDATES-CENTER-V1 — правила Центра обновлений.
 *
 * Чистый модуль: ни Prisma-клиента, ни Nest. Все решения о том, кто что видит
 * и кто что ведёт, собраны здесь и проверяются исполнением.
 *
 * Две области карточек:
 * - глобальная (companyId = null) — обновления платформы. Ведёт только
 *   PLATFORM_ADMIN, читают все компании;
 * - компании (companyId = id компании) — ведёт ADMIN этой компании, читают
 *   только её пользователи. Чужая компания такую карточку не видит ни в каком
 *   статусе: tenant isolation.
 *
 * Черновик читателям не виден никогда. Публикация — отдельное действие
 * уполномоченного администратора с явным подтверждением.
 */
import { Prisma, ProductUpdateStatus, UserRole } from '@prisma/client';

export type ProductUpdateActor = {
  id: string;
  role: UserRole | string;
  companyId: string | null;
};

/** Роли, которые ведут карточки. ManagementSurfaceGuard дополнительно сужает ADMIN по типу компании. */
export const PRODUCT_UPDATE_MANAGER_ROLES: readonly UserRole[] = [
  UserRole.PLATFORM_ADMIN,
  UserRole.ADMIN,
];

export function canManageProductUpdates(
  actor: Pick<ProductUpdateActor, 'role' | 'companyId'>,
): boolean {
  if (actor.role === UserRole.PLATFORM_ADMIN) return true;
  return actor.role === UserRole.ADMIN && !!actor.companyId;
}

/**
 * Область, которую ведёт администратор: null — глобальная (PLATFORM_ADMIN),
 * иначе — его компания. Компанию из запроса не берём никогда: ADMIN не может
 * указать чужую, PLATFORM_ADMIN ведёт только глобальные карточки.
 */
export function managedCompanyIdFor(actor: ProductUpdateActor): string | null {
  if (actor.role === UserRole.PLATFORM_ADMIN) return null;
  if (actor.role === UserRole.ADMIN && actor.companyId) return actor.companyId;
  throw new Error('PRODUCT_UPDATE_MANAGE_FORBIDDEN');
}

/** Условие «карточка в области, которую ведёт этот администратор». */
export function managedWhere(
  actor: ProductUpdateActor,
): Prisma.ProductUpdateWhereInput {
  return { companyId: managedCompanyIdFor(actor) };
}

/**
 * Что видит читатель: только опубликованные карточки — глобальные и своей
 * компании, — адресованные его роли (пустой список ролей = всем).
 */
export function readableWhere(
  actor: ProductUpdateActor,
): Prisma.ProductUpdateWhereInput {
  const scope: Prisma.ProductUpdateWhereInput[] = [{ companyId: null }];
  if (actor.companyId) scope.push({ companyId: actor.companyId });

  const role = Object.values(UserRole).includes(actor.role as UserRole)
    ? (actor.role as UserRole)
    : null;
  const audience: Prisma.ProductUpdateWhereInput[] = [
    { audienceRoles: { isEmpty: true } },
  ];
  if (role) audience.push({ audienceRoles: { has: role } });

  return {
    AND: [
      { status: ProductUpdateStatus.PUBLISHED },
      { OR: scope },
      { OR: audience },
    ],
  };
}

// ─── Проверка содержимого ───────────────────────────────────────────────────

export type ProductUpdateMedia = { url: string; caption: string };

export const MEDIA_LIMIT = 10;
export const CAPTION_MAX = 300;

/**
 * Ссылка на функцию — только внутренний путь приложения.
 *
 * Внешний URL, протокол-относительный //host и javascript: отвергаются: карточку
 * видят все пользователи, и ссылка из неё не должна уводить за пределы продукта.
 */
export function normalizeFeaturePath(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error('FEATURE_PATH_INVALID');
  const path = value.trim();
  if (!path) return null;
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[\s\\]/.test(path) ||
    path.length > 300
  ) {
    throw new Error('FEATURE_PATH_INVALID');
  }
  return path;
}

/**
 * Изображение — https-адрес или путь приложения (/uploads/...).
 * http:, data:, javascript: и прочие схемы отвергаются.
 */
function normalizeMediaUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('MEDIA_URL_INVALID');
  const url = value.trim();
  if (url.startsWith('/') && !url.startsWith('//') && !/\s/.test(url))
    return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return parsed.toString();
  } catch {
    /* ниже — отказ */
  }
  throw new Error('MEDIA_URL_INVALID');
}

export function normalizeMedia(value: unknown): ProductUpdateMedia[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('MEDIA_INVALID');
  if (value.length > MEDIA_LIMIT) throw new Error('MEDIA_TOO_MANY');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('MEDIA_INVALID');
    const raw = item as { url?: unknown; caption?: unknown };
    const caption = typeof raw.caption === 'string' ? raw.caption.trim() : '';
    if (caption.length > CAPTION_MAX) throw new Error('MEDIA_CAPTION_TOO_LONG');
    return { url: normalizeMediaUrl(raw.url), caption };
  });
}

/** Роли аудитории: только существующие, без повторов. PLATFORM_ADMIN адресовать не нужно — он видит своё. */
export function normalizeAudienceRoles(value: unknown): UserRole[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('AUDIENCE_INVALID');
  const known = new Set<string>(Object.values(UserRole));
  const out: UserRole[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !known.has(item))
      throw new Error('AUDIENCE_INVALID');
    if (!out.includes(item as UserRole)) out.push(item as UserRole);
  }
  return out;
}

/** Поля, без которых карточку нельзя опубликовать: читатель увидит пустые разделы. */
export function missingForPublish(update: {
  title?: string | null;
  summary?: string | null;
  changes?: string | null;
  howToUse?: string | null;
}): string[] {
  const missing: string[] = [];
  if (!update.title?.trim()) missing.push('title');
  if (!update.summary?.trim()) missing.push('summary');
  if (!update.changes?.trim()) missing.push('changes');
  if (!update.howToUse?.trim()) missing.push('howToUse');
  return missing;
}

// ─── Основа автосоздания после Production-релиза ────────────────────────────

export type ReleaseDraftInput = {
  releaseCommitSha: string;
  title: string;
  summary: string;
  changes: string;
  howToUse?: string;
  featurePath?: string | null;
  audienceRoles?: string[];
};

const SHA = /^[0-9a-f]{7,40}$/;

/**
 * Данные черновика из Production-релиза.
 *
 * Только черновик и только глобальный: автоматика карточку не публикует,
 * публикует администратор после проверки текста. Повтор по тому же SHA
 * распознаётся по releaseCommitSha (см. сервис).
 */
export function buildReleaseDraft(
  input: ReleaseDraftInput,
  systemActorId: string,
) {
  const sha = (input.releaseCommitSha || '').trim().toLowerCase();
  if (!SHA.test(sha)) throw new Error('RELEASE_SHA_INVALID');
  return {
    companyId: null,
    status: ProductUpdateStatus.DRAFT,
    source: 'RELEASE' as const,
    releaseCommitSha: sha,
    title: input.title.trim(),
    summary: input.summary.trim(),
    changes: input.changes.trim(),
    howToUse: (input.howToUse ?? '').trim(),
    featurePath: normalizeFeaturePath(input.featurePath),
    media: [] as ProductUpdateMedia[],
    audienceRoles: normalizeAudienceRoles(input.audienceRoles),
    createdById: systemActorId,
  };
}
