/**
 * SMA-UPDATES-CENTER-V1 — Центр обновлений, правила отображения.
 *
 * Чистый модуль: ни React, ни сети. Окружение тестов node.
 *
 * Прав модуль не выдаёт. Что видит читатель, решает бэкенд (опубликовано +
 * своя компания или глобальное + роль). Здесь — только подсказки интерфейсу
 * и повторная проверка ссылок перед выводом: карточку видят все пользователи,
 * и опасная ссылка не должна попасть в разметку, даже если пришла с сервера.
 */
import type { ProductUpdate, ProductUpdateInput, ProductUpdateMedia, Role } from './api'

/** Роли, которым можно адресовать карточку, с русскими подписями. */
export const AUDIENCE_ROLE_OPTIONS: ReadonlyArray<[Role, string]> = [
  ['ADMIN', 'Администраторы'],
  ['CLIENT_ADMIN', 'Администраторы клиента'],
  ['DISPATCHER', 'Диспетчеры'],
  ['MASTER', 'Мастера'],
  ['TECHNICIAN', 'Техники'],
  ['CLIENT', 'Клиенты'],
  ['TERRITORIAL_MANAGER', 'Территориальные менеджеры'],
  ['NETWORK_DIRECTOR', 'Директора сети'],
  ['STAFF', 'Сотрудники'],
]

const ROLE_LABEL = new Map<string, string>(AUDIENCE_ROLE_OPTIONS)

/** Кому адресована карточка — подпись для списка и карточки. */
export function audienceLabel(roles: readonly string[] | null | undefined): string {
  if (!roles || roles.length === 0) return 'Для всех'
  return roles.map((role) => ROLE_LABEL.get(role) ?? role).join(', ')
}

/**
 * Показывать ли раздел «Управление».
 *
 * Зеркалит бэкенд: @Roles(PLATFORM_ADMIN, ADMIN) + ManagementSurfaceGuard.
 * Это подсказка интерфейсу; граница доступа — на бэкенде.
 */
export function canManageProductUpdates(
  me: { role?: string | null; canAccessManagementSurface?: boolean | null } | null | undefined,
): boolean {
  if (me?.role === 'PLATFORM_ADMIN') return true
  return me?.role === 'ADMIN' && me.canAccessManagementSurface === true
}

/** Кто ведёт карточки этого администратора — для подписи раздела. */
export function managedScopeLabel(role?: string | null): string {
  return role === 'PLATFORM_ADMIN' ? 'Обновления платформы — видят все компании' : 'Обновления вашей компании — видят только её пользователи'
}

/** Ссылка на функцию — только внутренний путь приложения, иначе null (ссылку не выводим). */
export function safeFeaturePath(path: string | null | undefined): string | null {
  const value = (path ?? '').trim()
  if (!value.startsWith('/') || value.startsWith('//') || /[\s\\]/.test(value)) return null
  return value
}

/** Адрес изображения — https или путь приложения, иначе null (картинку не выводим). */
export function safeMediaUrl(url: string | null | undefined): string | null {
  const value = (url ?? '').trim()
  if (value.startsWith('/') && !value.startsWith('//') && !/\s/.test(value)) return value
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

/** Изображения, которые можно вывести; остальные отброшены. */
export function visibleMedia(media: readonly ProductUpdateMedia[] | null | undefined): ProductUpdateMedia[] {
  const out: ProductUpdateMedia[] = []
  for (const item of media ?? []) {
    const url = safeMediaUrl(item?.url)
    if (url) out.push({ url, caption: (item.caption ?? '').trim() })
  }
  return out
}

/** Дата публикации по-русски. Нет даты — прочерк, а не «1 января 1970». */
export function formatUpdateDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Многострочный текст раздела → абзацы (пустые строки отбрасываются). */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export const STATUS_LABEL: Record<ProductUpdate['status'], string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликовано',
}

// ─── Форма редактора ────────────────────────────────────────────────────────

export type ProductUpdateForm = {
  title: string
  summary: string
  changes: string
  howToUse: string
  featurePath: string
  media: ProductUpdateMedia[]
  audienceRoles: Role[]
}

export const EMPTY_FORM: ProductUpdateForm = {
  title: '',
  summary: '',
  changes: '',
  howToUse: '',
  featurePath: '',
  media: [],
  audienceRoles: [],
}

export function formFromUpdate(update: ProductUpdate): ProductUpdateForm {
  return {
    title: update.title ?? '',
    summary: update.summary ?? '',
    changes: update.changes ?? '',
    howToUse: update.howToUse ?? '',
    featurePath: update.featurePath ?? '',
    media: (update.media ?? []).map((m) => ({ url: m.url, caption: m.caption ?? '' })),
    audienceRoles: [...(update.audienceRoles ?? [])],
  }
}

/** Ошибки формы, которые видно до отправки. Бэкенд проверяет то же самое заново. */
export function formErrors(form: ProductUpdateForm): string[] {
  const errors: string[] = []
  if (form.featurePath.trim() && !safeFeaturePath(form.featurePath)) {
    errors.push('Ссылка на функцию — путь приложения, начинается с «/», например /inspection/schedules')
  }
  form.media.forEach((item, index) => {
    if (!item.url.trim()) errors.push(`Изображение ${index + 1}: укажите адрес`)
    else if (!safeMediaUrl(item.url)) errors.push(`Изображение ${index + 1}: только https:// или путь /uploads/…`)
  })
  return errors
}

/** Чего не хватает для публикации — те же четыре раздела, что требует бэкенд. */
export function missingForPublish(form: Pick<ProductUpdateForm, 'title' | 'summary' | 'changes' | 'howToUse'>): string[] {
  const missing: string[] = []
  if (!form.title.trim()) missing.push('Заголовок')
  if (!form.summary.trim()) missing.push('Краткое описание')
  if (!form.changes.trim()) missing.push('Что изменилось')
  if (!form.howToUse.trim()) missing.push('Как пользоваться')
  return missing
}

export function inputFromForm(form: ProductUpdateForm): ProductUpdateInput {
  return {
    title: form.title.trim(),
    summary: form.summary.trim(),
    changes: form.changes.trim(),
    howToUse: form.howToUse.trim(),
    featurePath: form.featurePath.trim() || null,
    media: form.media.map((m) => ({ url: m.url.trim(), caption: m.caption.trim() })),
    audienceRoles: form.audienceRoles,
  }
}
