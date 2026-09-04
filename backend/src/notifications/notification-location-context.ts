/**
 * Контекст локации в тексте уведомления по заявке: «<Город> · <Точка>».
 *
 * Формат один на все каналы (in-app, центр уведомлений, push, MAX). Канал
 * получает уже готовую строку и ничего в ней не пересобирает — иначе тексты
 * разъезжаются по каналам.
 *
 * Источник данных канонический: Location.city и Location.name заявки.
 */

/** Разделитель города и точки. */
export const LOCATION_CONTEXT_SEPARATOR = ' · ';

export type NotificationLocationSource =
  | {
      city?: string | null;
      name?: string | null;
    }
  | null
  | undefined;

function normalizeLocationPart(value?: string | null) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Правило формата и падения:
 * город и точка → «<Город> · <Точка>»;
 * нет города → точка; нет точки → город; нет ни того, ни другого → null.
 *
 * Город не повторяем только когда имя точки буквально равно городу. Разбирать
 * имя точки на вхождение города нельзя: модель данных этого не подтверждает —
 * name и city независимые свободные поля, и «Уфимская» в имени точки городом
 * не является.
 */
export function formatNotificationLocationContext(source: NotificationLocationSource): string | null {
  const city = normalizeLocationPart(source?.city);
  const name = normalizeLocationPart(source?.name);

  if (!city && !name) return null;
  if (!city) return name;
  if (!name) return city;
  if (name.toLocaleLowerCase('ru-RU') === city.toLocaleLowerCase('ru-RU')) return name;

  return `${city}${LOCATION_CONTEXT_SEPARATOR}${name}`;
}

/**
 * Ставит контекст локации первой строкой сообщения.
 *
 * Первой, а не последней: в свёрнутом push видно заголовок и начало текста,
 * и обрезка длинного текста контекст не съедает.
 *
 * Повторное применение ничего не добавляет — уведомление проходит и через
 * запись в БД, и через отправку push, обе точки зовут эту функцию.
 */
export function withNotificationLocationContext(message: string, context: string | null | undefined): string {
  const text = typeof message === 'string' ? message : '';
  const ctx = normalizeLocationPart(context);

  if (!ctx) return text;
  if (!text) return ctx;
  if (text === ctx || text.startsWith(`${ctx}\n`)) return text;

  return `${ctx}\n${text}`;
}
